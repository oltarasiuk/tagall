import { env } from "~/env";
import { MediaError } from "../errors/media.error";
import { providerRequest } from "../services/provider-http.service";
import type { ImageCandidateType, MediaProviderAdapterType, NormalizedItemDetailsType, ProviderSearchResultType } from "../types";
import { normalizeRating } from "../utils/normalize-rating.util";

type RawgGame = { id?: number; slug?: string; name?: string; released?: string; description_raw?: string; background_image?: string; rating?: number; ratings_count?: number; added?: number; genres?: { name?: string }[]; platforms?: { platform?: { name?: string } }[]; developers?: { name?: string }[]; tags?: { name?: string }[]; parent_platforms?: unknown[]; };
const names = (items: { name?: string }[] | undefined) => (items ?? []).map((item) => item.name?.trim()).filter((name): name is string => !!name);
const image = (game: RawgGame): ImageCandidateType[] => game.background_image ? [{ source: "rawg", url: game.background_image, width: null, height: null, language: null, likes: null, kind: "cover", canPersist: true }] : [];
const toResult = (game: RawgGame, index: number): ProviderSearchResultType | null => {
  if (!game.slug || !game.name) return null;
  return { provider: "rawg", externalId: game.slug, mediaKind: "game", title: game.name, originalTitle: null, originalLanguage: null, year: game.released ? Number(game.released.slice(0, 4)) || null : null, description: game.description_raw ?? null, authorsOrCreators: names(game.developers), seriesName: null, seriesPosition: null, identifiers: [{ provider: "rawg", externalId: game.slug, url: `https://rawg.io/games/${game.slug}` }], isbns: [], imageCandidates: image(game), rating: normalizeRating({ source: "rawg", value: game.rating ?? null, scale: 5, votes: game.ratings_count ?? null }), popularity: game.added != null ? { source: "rawg", value: game.added, kind: "members" } : null, genres: names(game.genres), keywords: names(game.tags), relevanceRank: index, sourceUrl: `https://rawg.io/games/${game.slug}` };
};
async function request<T>(path: string, params: Record<string, string | number>) {
  if (!env.RAWG_API_KEY) throw new MediaError("PROVIDER_DISABLED", "RAWG is not configured", { provider: "rawg" });
  return providerRequest<T>({ provider: "rawg", operation: "search", timeoutMs: 10_000 }, { url: `https://api.rawg.io/api/${path}`, params: { ...params, key: env.RAWG_API_KEY } });
}
export const rawgProvider: MediaProviderAdapterType = {
  name: "rawg", supportedKinds: ["game"], get enabled() { return Boolean(env.RAWG_API_KEY); },
  async search(input) { const response = await request<{ results?: RawgGame[] }>("games", { search: input.query, page_size: input.limit }); return (response.results ?? []).flatMap((game, index) => { const result = toResult(game, index); return result ? [result] : []; }); },
  async getDetails(externalId): Promise<NormalizedItemDetailsType> { const game = await request<RawgGame>(`games/${encodeURIComponent(externalId)}`, {}); const result = toResult(game, 0); if (!result) throw new MediaError("ITEM_NOT_FOUND", `RAWG has no game ${externalId}`, { provider: "rawg" }); return { mediaKind: "game", title: result.title, originalTitle: null, originalLanguage: null, year: result.year, description: result.description, sourceUrl: result.sourceUrl, identifiers: result.identifiers, imageCandidates: result.imageCandidates, rating: result.rating, fields: { genres: result.genres, keywords: result.keywords, people: result.authorsOrCreators, platforms: (game.platforms ?? []).map((item) => item.platform?.name).filter((name): name is string => !!name) } }; },
};
