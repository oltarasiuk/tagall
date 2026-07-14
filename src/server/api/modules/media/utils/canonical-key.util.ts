import { ExternalProvider } from "@prisma/client";

/**
 * Canonical key stored in `Item.parsedId`: "<provider>:<external id>".
 *
 * The provider prefix is lower-case, the external id is kept byte-exact
 * (only trimmed). Never run it through `normalizeText()` — providers such as
 * Open Library ("OL82563W") and Google Books use case-sensitive ids.
 */

export const PROVIDER_PREFIXES: Record<ExternalProvider, string> = {
  [ExternalProvider.IMDB]: "imdb",
  [ExternalProvider.TMDB]: "tmdb",
  [ExternalProvider.ANILIST]: "anilist",
  [ExternalProvider.OPEN_LIBRARY]: "openlibrary",
  [ExternalProvider.HARDCOVER]: "hardcover",
  [ExternalProvider.GOOGLE_BOOKS]: "google-books",
  [ExternalProvider.IGDB]: "igdb",
  [ExternalProvider.RAWG]: "rawg",
  [ExternalProvider.STEAM]: "steam",
  [ExternalProvider.BGG]: "bgg",
  [ExternalProvider.VNDB]: "vndb",
  [ExternalProvider.FANART_TV]: "fanart-tv",
  [ExternalProvider.STEAMGRIDDB]: "steamgriddb",
  [ExternalProvider.MANGADEX]: "mangadex",
};

const PROVIDER_BY_PREFIX = new Map<string, ExternalProvider>(
  Object.entries(PROVIDER_PREFIXES).map(([provider, prefix]) => [
    prefix,
    provider as ExternalProvider,
  ]),
);

export type CanonicalKeyPartsType = {
  provider: ExternalProvider;
  externalId: string;
};

export function buildCanonicalKey(
  provider: ExternalProvider,
  externalId: string,
): string {
  const trimmed = externalId.trim();

  if (!trimmed) {
    throw new Error(`Empty external id for provider "${provider}"`);
  }

  return `${PROVIDER_PREFIXES[provider]}:${trimmed}`;
}

export function parseCanonicalKey(key: string): CanonicalKeyPartsType | null {
  const separatorIndex = key.indexOf(":");

  if (separatorIndex <= 0) {
    return null;
  }

  const provider = PROVIDER_BY_PREFIX.get(key.slice(0, separatorIndex));
  const externalId = key.slice(separatorIndex + 1).trim();

  if (!provider || !externalId) {
    return null;
  }

  return { provider, externalId };
}

export function isCanonicalKey(key: string): boolean {
  return parseCanonicalKey(key) !== null;
}
