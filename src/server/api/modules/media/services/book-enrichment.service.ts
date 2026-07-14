import { logger } from "~/lib/logger";
import { providerRegistry, type ProviderRegistryType } from "../providers";
import type {
  NormalizedItemDetailsType,
  ProviderNameType,
  ProviderSearchResultType,
} from "../types";
import {
  hasConflictingVolume,
  isSamePrimaryCreator,
} from "../utils/similarity.util";
import { normalizeTitle, normalizeTitleLoose } from "../utils/normalize-title.util";

/**
 * A merged search card promises one item carrying both providers' identifiers,
 * but the add flow re-fetches details from the primary provider alone — the
 * client's copy of the merge is not trusted for writes. So the counterpart is
 * looked up again here, server-side, under the same matching rules the merge
 * used.
 *
 * It also fills what Open Library rarely has: a description, a series, genres.
 * Enrichment is best-effort — if Hardcover is down or unconfigured, the book is
 * still added, just with fewer identifiers.
 */

const COUNTERPART: Partial<Record<ProviderNameType, ProviderNameType>> = {
  openlibrary: "hardcover",
  hardcover: "openlibrary",
};

const CANDIDATE_LIMIT = 5;

const toStringArray = (value: unknown): string[] => {
  if (Array.isArray(value)) {
    return value.filter((entry): entry is string => typeof entry === "string");
  }

  return typeof value === "string" ? [value] : [];
};

const findMatch = (
  details: NormalizedItemDetailsType,
  candidates: ProviderSearchResultType[],
): ProviderSearchResultType | null => {
  const creators = toStringArray(details.fields.people);

  return (
    candidates.find(
      (candidate) =>
        [candidate.title, candidate.originalTitle, ...(candidate.alternateTitles ?? [])]
          .filter((title): title is string => Boolean(title))
          .some((title) => {
            const a = normalizeTitle(details.title);
            const b = normalizeTitle(title);
            return a === b || normalizeTitleLoose(a) === normalizeTitleLoose(b);
          }) &&
        isSamePrimaryCreator(creators, candidate.authorsOrCreators) &&
        !hasConflictingVolume(details.title, candidate.title),
    ) ?? null
  );
};

const mergeFields = (
  details: NormalizedItemDetailsType,
  match: ProviderSearchResultType,
): NormalizedItemDetailsType["fields"] => {
  const genres = [
    ...new Set([...toStringArray(details.fields.genres), ...match.genres]),
  ].slice(0, 10);
  const keywords = [
    ...new Set([...toStringArray(details.fields.keywords), ...match.keywords]),
  ].slice(0, 20);

  return {
    ...details.fields,
    genres,
    keywords,
    series: details.fields.series ?? match.seriesName,
  };
};

export async function enrichBookDetails(props: {
  provider: ProviderNameType;
  details: NormalizedItemDetailsType;
  registry?: ProviderRegistryType;
}): Promise<NormalizedItemDetailsType> {
  const { provider, details, registry = providerRegistry } = props;

  if (details.mediaKind !== "book" && details.mediaKind !== "comic") {
    return details;
  }

  const counterpart = COUNTERPART[provider];
  const adapter = counterpart ? registry.getByName(counterpart) : null;

  if (!adapter?.enabled) {
    return details;
  }

  // Providers receive a title-only query. Author text is used only locally to
  // verify a candidate, never as a broad search term.
  const query = details.title;

  let candidates: ProviderSearchResultType[];

  try {
    candidates = await adapter.search({ query, limit: CANDIDATE_LIMIT });
  } catch (error) {
    logger.error(
      `[media] ${adapter.name} enrichment lookup failed for "${details.title}"`,
      error,
    );

    return details;
  }

  const match = findMatch(details, candidates);

  if (!match) {
    logger.debug(
      `[media] No ${adapter.name} counterpart for "${details.title}"`,
    );

    return details;
  }

  logger.debug(
    `[media] Enriched "${details.title}" with ${adapter.name}:${match.externalId}`,
  );

  const rating =
    (match.rating?.votes ?? 0) > (details.rating?.votes ?? 0)
      ? match.rating
      : details.rating;

  return {
    ...details,
    description: details.description ?? match.description,
    originalTitle: details.originalTitle ?? match.originalTitle,
    originalLanguage: details.originalLanguage ?? match.originalLanguage,
    year: details.year ?? match.year,
    // Both identities now point at one item, so a later search from either
    // provider finds it instead of creating a twin.
    identifiers: [...details.identifiers, ...match.identifiers],
    imageCandidates: [...details.imageCandidates, ...match.imageCandidates],
    // Ratings are picked, never averaged: the one with more votes wins.
    rating,
    fields: mergeFields(details, match),
  };
}
