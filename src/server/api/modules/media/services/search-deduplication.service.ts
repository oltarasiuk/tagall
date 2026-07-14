import type {
  ExternalIdentifierValueType,
  ImageCandidateType,
  MediaKindType,
  NormalizedRatingType,
  ProviderNameType,
  ProviderSearchResultType,
} from "../types";
import { normalizeIsbns } from "../utils/normalize-isbn.util";
import {
  hasConflictingVolume,
  isCompatibleYear,
  isSamePrimaryCreator,
  isSameTitle,
} from "../utils/similarity.util";

/**
 * Two providers describing one work must reach the UI as one card and the
 * database as one item with several identifiers. Doing that in React would only
 * hide the duplicate; the add flow would still create two items.
 *
 * Merging happens in two passes. Hard matches (a shared identifier, a shared
 * ISBN) are facts and merge unconditionally. Heuristics only run inside one
 * media kind and demand agreement on title, primary creator and year — a wrong
 * merge loses a work, so the bar is exact matches, never fuzzy distance.
 */

const MAX_MERGED_GENRES = 10;
const MAX_MERGED_KEYWORDS = 20;

/** Which provider owns the identity of a merged result, best first. */
const IDENTITY_PRECEDENCE: Partial<Record<MediaKindType, ProviderNameType[]>> = {
  book: ["openlibrary", "hardcover"],
  comic: ["openlibrary", "hardcover"],
  game: ["igdb", "rawg"],
};

/** Descriptions are often empty on the identity provider; these fill in. */
const DESCRIPTION_PRECEDENCE: Partial<Record<MediaKindType, ProviderNameType[]>> =
  {
    book: ["hardcover", "openlibrary"],
    comic: ["hardcover", "openlibrary"],
    game: ["igdb", "rawg"],
  };

const rank = (
  provider: ProviderNameType,
  precedence: readonly ProviderNameType[] | undefined,
): number => {
  const index = precedence?.indexOf(provider) ?? -1;

  return index === -1 ? Number.MAX_SAFE_INTEGER : index;
};

class UnionFind {
  private readonly parent: number[];

  constructor(size: number) {
    this.parent = Array.from({ length: size }, (_, index) => index);
  }

  find(index: number): number {
    while (this.parent[index] !== index) {
      this.parent[index] = this.parent[this.parent[index]!]!;
      index = this.parent[index]!;
    }

    return index;
  }

  union(a: number, b: number): void {
    const rootA = this.find(a);
    const rootB = this.find(b);

    if (rootA !== rootB) {
      this.parent[rootB] = rootA;
    }
  }
}

/** Every fact that, if shared, means "the same work". */
const hardKeys = (result: ProviderSearchResultType): string[] => [
  ...result.identifiers.map(
    (identifier) => `${identifier.provider}:${identifier.externalId}`,
  ),
  ...normalizeIsbns(result.isbns).map((isbn) => `isbn:${isbn}`),
];

const isHeuristicMatch = (
  a: ProviderSearchResultType,
  b: ProviderSearchResultType,
): boolean => {
  if (a.provider === b.provider || a.mediaKind !== b.mediaKind) {
    return false;
  }

  if (!IDENTITY_PRECEDENCE[a.mediaKind]) {
    return false;
  }

  return (
    isSameTitle(a.title, b.title) &&
    isSamePrimaryCreator(a.authorsOrCreators, b.authorsOrCreators) &&
    isCompatibleYear(a.year, b.year) &&
    !hasConflictingVolume(a.title, b.title)
  );
};

const uniqueBy = <T>(values: T[], key: (value: T) => string): T[] => {
  const seen = new Set<string>();

  return values.filter((value) => {
    const id = key(value);

    if (seen.has(id)) {
      return false;
    }

    seen.add(id);

    return true;
  });
};

const mergeIdentifiers = (
  group: ProviderSearchResultType[],
): ExternalIdentifierValueType[] =>
  uniqueBy(
    group.flatMap((result) => result.identifiers),
    (identifier) => `${identifier.provider}:${identifier.externalId}`,
  );

const mergeImages = (
  group: ProviderSearchResultType[],
): ImageCandidateType[] =>
  uniqueBy(
    group.flatMap((result) => result.imageCandidates),
    (candidate) => candidate.url,
  );

/**
 * Ratings are never averaged across providers: a 4.3 from 12 Hardcover votes
 * and an 8.6 from 1,273 Open Library ones do not average into anything real.
 * The source with the most votes wins and keeps its name.
 */
const mergeRating = (
  group: ProviderSearchResultType[],
): NormalizedRatingType | null => {
  const ratings = group
    .map((result) => result.rating)
    .filter((rating): rating is NormalizedRatingType => !!rating);

  if (ratings.length === 0) {
    return null;
  }

  return ratings.reduce((best, rating) =>
    (rating.votes ?? 0) > (best.votes ?? 0) ? rating : best,
  );
};

const mergeGroup = (
  group: ProviderSearchResultType[],
): ProviderSearchResultType => {
  if (group.length === 1) {
    return group[0]!;
  }

  const mediaKind = group[0]!.mediaKind;
  const byIdentity = [...group].sort(
    (a, b) =>
      rank(a.provider, IDENTITY_PRECEDENCE[mediaKind]) -
        rank(b.provider, IDENTITY_PRECEDENCE[mediaKind]) ||
      a.relevanceRank - b.relevanceRank,
  );
  const primary = byIdentity[0]!;

  const byDescription = [...group].sort(
    (a, b) =>
      rank(a.provider, DESCRIPTION_PRECEDENCE[mediaKind]) -
      rank(b.provider, DESCRIPTION_PRECEDENCE[mediaKind]),
  );

  const firstOf = <T>(
    source: ProviderSearchResultType[],
    pick: (result: ProviderSearchResultType) => T | null | undefined,
  ): T | null => {
    for (const result of source) {
      const value = pick(result);

      if (value != null && value !== "") {
        return value;
      }
    }

    return null;
  };

  return {
    ...primary,
    // The identity provider names the item; the others only fill its gaps.
    description: firstOf(byDescription, (result) => result.description),
    originalTitle: firstOf(byIdentity, (result) => result.originalTitle),
    originalLanguage: firstOf(byIdentity, (result) => result.originalLanguage),
    year: firstOf(byIdentity, (result) => result.year),
    seriesName: firstOf(byIdentity, (result) => result.seriesName),
    seriesPosition: firstOf(byIdentity, (result) => result.seriesPosition),
    authorsOrCreators:
      byIdentity.find((result) => result.authorsOrCreators.length > 0)
        ?.authorsOrCreators ?? [],
    identifiers: mergeIdentifiers(byIdentity),
    isbns: normalizeIsbns(byIdentity.flatMap((result) => result.isbns)),
    imageCandidates: mergeImages(byIdentity),
    rating: mergeRating(group),
    genres: [...new Set(byIdentity.flatMap((result) => result.genres))].slice(
      0,
      MAX_MERGED_GENRES,
    ),
    keywords: [
      ...new Set(byIdentity.flatMap((result) => result.keywords)),
    ].slice(0, MAX_MERGED_KEYWORDS),
    // A work found by two providers is at least as relevant as the best of them.
    relevanceRank: Math.min(...group.map((result) => result.relevanceRank)),
  };
};

export function dedupeSearchResults(
  results: ProviderSearchResultType[],
): ProviderSearchResultType[] {
  if (results.length < 2) {
    return results;
  }

  const unionFind = new UnionFind(results.length);
  const byHardKey = new Map<string, number>();

  results.forEach((result, index) => {
    for (const key of hardKeys(result)) {
      const owner = byHardKey.get(key);

      if (owner == null) {
        byHardKey.set(key, index);
        continue;
      }

      unionFind.union(owner, index);
    }
  });

  for (let i = 0; i < results.length; i++) {
    for (let j = i + 1; j < results.length; j++) {
      if (
        unionFind.find(i) !== unionFind.find(j) &&
        isHeuristicMatch(results[i]!, results[j]!)
      ) {
        unionFind.union(i, j);
      }
    }
  }

  const groups = new Map<number, ProviderSearchResultType[]>();

  results.forEach((result, index) => {
    const root = unionFind.find(index);
    const group = groups.get(root) ?? [];

    group.push(result);
    groups.set(root, group);
  });

  // Insertion order of the groups follows the first result of each, so provider
  // relevance ordering survives the merge.
  return [...groups.values()].map(mergeGroup);
}
