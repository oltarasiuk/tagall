import { XMLParser } from "fast-xml-parser";
import { env } from "~/env";
import { MediaError } from "../errors/media.error";
import { providerRequest } from "../services/provider-http.service";
import type { ImageCandidateType, MediaProviderAdapterType, NormalizedItemDetailsType, ProviderSearchInputType, ProviderSearchResultType } from "../types";
import { normalizeRating } from "../utils/normalize-rating.util";

const parser = new XMLParser({ ignoreAttributes: false, attributeNamePrefix: "" });
const BGG_URL = "https://boardgamegeek.com/xmlapi2";
const asArray = <T>(value: T | T[] | undefined): T[] => value == null ? [] : Array.isArray(value) ? value : [value];
type Thing = Record<string, unknown>;
const attr = (value: unknown, key: string): string | null => {
  const candidate = value && typeof value === "object" ? (value as Record<string, unknown>)[key] : null;
  return typeof candidate === "string" ? candidate : null;
};
const numeric = (value: unknown, key: string): number | null => { const parsed = Number(attr(value, key)); return Number.isFinite(parsed) ? parsed : null; };
const values = (thing: Thing, key: string): string[] => asArray(thing[key]).map((item) => attr(item, "value")).filter((value): value is string => !!value);
const name = (thing: Thing): string | null => attr(asArray(thing.name).find((item) => attr(item, "type") === "primary") ?? asArray(thing.name)[0], "value");
const image = (thing: Thing): ImageCandidateType[] => typeof thing.image === "string" ? [{ source: "bgg", url: thing.image, width: null, height: null, language: null, likes: null, kind: "cover", canPersist: true }] : [];
const boardgameUrl = (id: string) => `https://boardgamegeek.com/boardgame/${id}`;

async function request(path: string, params: Record<string, string | number>): Promise<Thing> {
  if (!env.BGG_API_TOKEN) throw new MediaError("PROVIDER_DISABLED", "BoardGameGeek is awaiting token approval", { provider: "bgg" });
  const xml = await providerRequest<string>({ provider: "bgg", operation: "search", timeoutMs: 20_000, maxRetries: 2 }, { url: `${BGG_URL}/${path}`, params, headers: { Authorization: `Bearer ${env.BGG_API_TOKEN}`, Accept: "application/xml" }, responseType: "text" });
  return parser.parse(xml) as Thing;
}

const toResult = (thing: Thing, index: number): ProviderSearchResultType | null => {
  const id = attr(thing, "id");
  const title = name(thing);
  if (!id || !title || attr(thing, "type") === "boardgameexpansion") return null;
  const statistics = (thing.statistics as Thing | undefined)?.ratings as Thing | undefined;
  const average = numeric(statistics?.average, "value");
  const votes = numeric(statistics?.usersrated, "value");
  const rank = numeric(asArray(statistics?.ranks).flatMap((r) => asArray((r as Thing).rank))[0], "value");
  return { provider: "bgg", externalId: id, mediaKind: "board-game", title, originalTitle: null, originalLanguage: null, year: numeric(thing.yearpublished, "value"), description: typeof thing.description === "string" ? thing.description.replace(/<[^>]*>/g, "").trim() : null, authorsOrCreators: values(thing, "link").filter((_, i) => attr(asArray(thing.link)[i], "type") === "boardgamedesigner"), seriesName: null, seriesPosition: null, identifiers: [{ provider: "bgg", externalId: id, url: boardgameUrl(id) }], isbns: [], imageCandidates: image(thing), rating: normalizeRating({ source: "bgg", value: average, scale: 10, votes, kind: "bayesian" }), popularity: rank != null && rank > 0 ? { source: "bgg", value: 1 / rank, kind: "owners" } : null, genres: values(thing, "link").filter((_, i) => attr(asArray(thing.link)[i], "type") === "boardgamecategory"), keywords: values(thing, "link").filter((_, i) => attr(asArray(thing.link)[i], "type") === "boardgamemechanic"), relevanceRank: index, sourceUrl: boardgameUrl(id),
  };
};

export const bggProvider: MediaProviderAdapterType = {
  name: "bgg", supportedKinds: ["board-game"], get enabled() { return Boolean(env.BGG_API_TOKEN); },
  async search(input: ProviderSearchInputType) {
    const search = await request("search", { query: input.query, type: "boardgame", exact: 1 });
    const ids = asArray((search.items as Thing | undefined)?.item).map((item) => attr(item, "id")).filter((id): id is string => !!id).slice(0, input.limit);
    if (!ids.length) return [];
    const data = await request("thing", { id: ids.join(","), stats: 1 });
    return asArray<Thing>((data.items as Thing | undefined)?.item as Thing | Thing[] | undefined).flatMap((thing, index) => {
      const result = toResult(thing, index);
      return result ? [result] : [];
    });
  },
  async getDetails(externalId: string): Promise<NormalizedItemDetailsType> {
    if (!/^\d+$/.test(externalId)) throw new MediaError("ITEM_NOT_FOUND", "Invalid BGG id", { provider: "bgg" });
    const data = await request("thing", { id: externalId, stats: 1 });
    const thing = asArray<Thing>((data.items as Thing | undefined)?.item as Thing | Thing[] | undefined)[0] ?? ({} as Thing);
    const result = toResult(thing, 0);
    if (!result) throw new MediaError("ITEM_NOT_FOUND", `BGG has no base game ${externalId}`, { provider: "bgg" });
    const statistics = (thing.statistics as Thing | undefined)?.ratings as Thing | undefined;
    const minPlayers = numeric(thing.minplayers, "value"); const maxPlayers = numeric(thing.maxplayers, "value");
    return { mediaKind: "board-game", title: result.title, originalTitle: null, originalLanguage: null, year: result.year, description: result.description, sourceUrl: result.sourceUrl, identifiers: result.identifiers, imageCandidates: result.imageCandidates, rating: result.rating, fields: { genres: result.genres, mechanics: result.keywords, people: result.authorsOrCreators, players: minPlayers != null || maxPlayers != null ? `${minPlayers ?? "?"}–${maxPlayers ?? "?"}` : null, playingTime: numeric(thing.playingtime, "value"), complexity: numeric(statistics?.averageweight, "value") } };
  },
};
