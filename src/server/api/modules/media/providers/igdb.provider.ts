import { env } from "~/env";
import { MediaError } from "../errors/media.error";
import { providerRequest } from "../services/provider-http.service";
import type {
  ImageCandidateType,
  MediaProviderAdapterType,
  NormalizedItemDetailsType,
  ProviderSearchInputType,
  ProviderSearchResultType,
} from "../types";
import { normalizeRating } from "../utils/normalize-rating.util";
import { getSteamGridImages } from "./steamgriddb-image.provider";

const IGDB_URL = "https://api.igdb.com/v4/games";
const TWITCH_TOKEN_URL = "https://id.twitch.tv/oauth2/token";

type IgdbGame = {
  id?: number;
  name?: string;
  slug?: string;
  summary?: string;
  first_release_date?: number;
  cover?: { image_id?: string; width?: number; height?: number };
  rating?: number;
  rating_count?: number;
  total_rating?: number;
  total_rating_count?: number;
  genres?: { name?: string }[];
  themes?: { name?: string }[];
  game_modes?: { name?: string }[];
  platforms?: { name?: string }[];
  involved_companies?: { company?: { name?: string }; developer?: boolean }[];
  // `external_game_source` replaced the deprecated `category` enum. Steam = 1.
  external_games?: { external_game_source?: number; uid?: string }[];
  // `game_type` replaced the deprecated `category` enum.
  game_type?: number;
};

// External game source ids: Steam is 1 (same value the deprecated category used).
const STEAM_EXTERNAL_SOURCE = 1;
// game_type ids kept as base games: 0 = Main Game, 8 = Remake, 9 = Remaster.
const BASE_GAME_TYPES = "(0,8,9)";

let token: { value: string; expiresAt: number } | null = null;

async function getAccessToken(): Promise<string> {
  if (token && token.expiresAt > Date.now()) return token.value;
  const clientId = env.IGDB_CLIENT_ID;
  const clientSecret = env.IGDB_CLIENT_SECRET;
  if (!clientId || !clientSecret) {
    throw new MediaError("PROVIDER_DISABLED", "IGDB credentials are not configured", { provider: "igdb" });
  }
  const response = await providerRequest<{ access_token?: string; expires_in?: number }>(
    { provider: "igdb", operation: "details", timeoutMs: 8_000 },
    { url: TWITCH_TOKEN_URL, method: "POST", params: { client_id: clientId, client_secret: clientSecret, grant_type: "client_credentials" } },
  );
  if (!response.access_token) {
    throw new MediaError("PROVIDER_AUTH_FAILED", "Twitch returned no IGDB access token", { provider: "igdb" });
  }
  token = { value: response.access_token, expiresAt: Date.now() + Math.max(60, (response.expires_in ?? 3600) - 300) * 1000 };
  return token.value;
}

const names = (items: { name?: string }[] | undefined): string[] =>
  (items ?? []).map((item) => item.name?.trim()).filter((name): name is string => !!name);

const year = (timestamp?: number): number | null =>
  timestamp ? new Date(timestamp * 1000).getUTCFullYear() : null;

const cover = (game: IgdbGame): ImageCandidateType[] => {
  const imageId = game.cover?.image_id;
  return imageId ? [{
    source: "igdb", url: `https://images.igdb.com/igdb/image/upload/t_cover_big/${imageId}.jpg`,
    width: game.cover?.width ?? null, height: game.cover?.height ?? null,
    language: null, likes: null, kind: "cover", canPersist: true,
  }] : [];
};

const rating = (game: IgdbGame) => normalizeRating({
  source: "igdb", value: game.total_rating ?? game.rating ?? null, scale: 100,
  votes: game.total_rating_count ?? game.rating_count ?? null,
});

const steamId = (game: IgdbGame): string | null =>
  game.external_games?.find(
    (external) => external.external_game_source === STEAM_EXTERNAL_SOURCE,
  )?.uid ?? null;

async function requestGames(query: string): Promise<IgdbGame[]> {
  const accessToken = await getAccessToken();
  const clientId = env.IGDB_CLIENT_ID!;
  const data = await providerRequest<unknown>(
    { provider: "igdb", operation: "search", timeoutMs: 12_000 },
    { url: IGDB_URL, method: "POST", headers: { "Client-ID": clientId, Authorization: `Bearer ${accessToken}` }, data: query },
  );
  return Array.isArray(data) ? data as IgdbGame[] : [];
}

const fields = "id,name,slug,summary,first_release_date,cover.image_id,cover.width,cover.height,rating,rating_count,total_rating,total_rating_count,game_type,genres.name,themes.name,game_modes.name,platforms.name,involved_companies.developer,involved_companies.company.name,external_games.external_game_source,external_games.uid";

const toResult = (game: IgdbGame, index: number): ProviderSearchResultType | null => {
  if (!game.id || !game.name) return null;
  const id = String(game.id);
  const steam = steamId(game);
  return {
    provider: "igdb", externalId: id, mediaKind: "game", title: game.name,
    originalTitle: null, originalLanguage: null, year: year(game.first_release_date),
    description: game.summary ?? null,
    authorsOrCreators: (game.involved_companies ?? []).filter((item) => item.developer).map((item) => item.company?.name).filter((name): name is string => !!name),
    seriesName: null, seriesPosition: null,
    identifiers: [
      { provider: "igdb", externalId: id, url: `https://www.igdb.com/games/${game.slug ?? id}` },
      ...(steam ? [{ provider: "steam" as const, externalId: steam, url: `https://store.steampowered.com/app/${steam}` }] : []),
    ],
    isbns: [], imageCandidates: cover(game), rating: rating(game),
    popularity: null,
    genres: names(game.genres), keywords: names(game.themes), relevanceRank: index,
    sourceUrl: `https://www.igdb.com/games/${game.slug ?? id}`,
  };
};

export const igdbProvider: MediaProviderAdapterType = {
  name: "igdb", supportedKinds: ["game"],
  get enabled() { return Boolean(env.IGDB_CLIENT_ID && env.IGDB_CLIENT_SECRET); },
  async search(input: ProviderSearchInputType) {
    const escaped = input.query.replace(/"/g, "\\\"");
    const games = await requestGames(`search "${escaped}"; fields ${fields}; where game_type = ${BASE_GAME_TYPES}; limit ${input.limit};`);
    const results = games.flatMap((game, index) => {
      const result = toResult(game, index);
      return result ? [result] : [];
    });
    const enriched = await Promise.all(results.map(async (result, index) => {
      const steam = result.identifiers.find((identifier) => identifier.provider === "steam")?.externalId;
      const grids = steam ? await getSteamGridImages(steam) : [];
      return { ...result, imageCandidates: [...grids, ...result.imageCandidates], relevanceRank: index };
    }));
    return enriched;
  },
  async getDetails(externalId: string): Promise<NormalizedItemDetailsType> {
    if (!/^\d+$/.test(externalId)) throw new MediaError("ITEM_NOT_FOUND", "Invalid IGDB id", { provider: "igdb" });
    const [game] = await requestGames(`fields ${fields}; where id = ${externalId} & game_type = ${BASE_GAME_TYPES}; limit 1;`);
    const result = game ? toResult(game, 0) : null;
    if (!result) throw new MediaError("ITEM_NOT_FOUND", `IGDB has no base game ${externalId}`, { provider: "igdb" });
    const steam = result.identifiers.find((identifier) => identifier.provider === "steam")?.externalId;
    const grids = steam ? await getSteamGridImages(steam) : [];
    return { mediaKind: "game", title: result.title, originalTitle: null, originalLanguage: null, year: result.year, description: result.description, sourceUrl: result.sourceUrl, identifiers: result.identifiers, imageCandidates: [...grids, ...result.imageCandidates], rating: result.rating, fields: { genres: result.genres, keywords: result.keywords, people: result.authorsOrCreators, platforms: names(game!.platforms), gameModes: names(game!.game_modes), themes: names(game!.themes) } };
  },
};
