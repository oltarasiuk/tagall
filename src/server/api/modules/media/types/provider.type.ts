import type { ExternalProvider } from "@prisma/client";

export const MEDIA_KINDS = [
  "film",
  "serie",
  "book",
  "manga",
  "comic",
  "visual-novel",
  "game",
  "board-game",
] as const;

export type MediaKindType = (typeof MEDIA_KINDS)[number];

/**
 * Provider name = the lower-case prefix of a canonical key.
 *
 * It names the *identity* namespace, not necessarily the HTTP source: video
 * items are fetched from TMDB but identified by their IMDb id, which is what
 * every existing item already carries.
 */
export const PROVIDER_PREFIXES = {
  IMDB: "imdb",
  TMDB: "tmdb",
  ANILIST: "anilist",
  OPEN_LIBRARY: "openlibrary",
  HARDCOVER: "hardcover",
  GOOGLE_BOOKS: "google-books",
  IGDB: "igdb",
  RAWG: "rawg",
  STEAM: "steam",
  BGG: "bgg",
  VNDB: "vndb",
  FANART_TV: "fanart-tv",
  STEAMGRIDDB: "steamgriddb",
  MANGADEX: "mangadex",
} as const satisfies Record<ExternalProvider, string>;

export type ProviderNameType = (typeof PROVIDER_PREFIXES)[ExternalProvider];

const PROVIDER_BY_PREFIX = new Map<string, ExternalProvider>(
  Object.entries(PROVIDER_PREFIXES).map(([provider, prefix]) => [
    prefix,
    provider as ExternalProvider,
  ]),
);

export const toProviderName = (provider: ExternalProvider): ProviderNameType =>
  PROVIDER_PREFIXES[provider];

export const toProviderEnum = (name: string): ExternalProvider | null =>
  PROVIDER_BY_PREFIX.get(name) ?? null;
