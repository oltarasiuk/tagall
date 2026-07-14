import type { ProviderSearchResultType } from "../types";
import { normalizeTitle } from "../utils/normalize-title.util";

const meaningfulTokens = (value: string): string[] =>
  normalizeTitle(value)
    .split(" ")
    .filter((token) => token.length > 1);

const titleTier = (result: ProviderSearchResultType, query: string): number => {
  const normalizedQuery = normalizeTitle(query);
  const titles = [result.title, result.originalTitle].map(normalizeTitle);

  if (titles.includes(normalizedQuery)) return 1;
  if (titles.some((title) => title.startsWith(normalizedQuery))) return 2;

  const tokens = meaningfulTokens(query);
  if (
    tokens.length &&
    titles.some((title) => tokens.every((token) => title.includes(token)))
  )
    return 3;
  return 4;
};

const normalized = (value: number, min: number, max: number): number =>
  max === min ? 0.5 : (value - min) / (max - min);

/**
 * Stable Best match ranking. It deliberately compares popularity only among
 * results from the same provider, never raw provider-native counters.
 */
export function rankSearchResults(
  results: ProviderSearchResultType[],
  query: string,
): ProviderSearchResultType[] {
  const byProvider = new Map<string, ProviderSearchResultType[]>();
  results.forEach((result) => {
    const entries = byProvider.get(result.provider) ?? [];
    entries.push(result);
    byProvider.set(result.provider, entries);
  });

  const scores = new Map<
    ProviderSearchResultType,
    { tier: number; score: number; votes: number }
  >();
  byProvider.forEach((entries) => {
    const maxRank = Math.max(...entries.map((entry) => entry.relevanceRank), 1);
    const popularities = entries.map((entry) =>
      Math.log1p(entry.popularity?.value ?? entry.rating?.votes ?? 0),
    );
    const minPopularity = Math.min(...popularities);
    const maxPopularity = Math.max(...popularities);
    const qualities = entries.map((entry) => entry.rating?.normalized10 ?? 5);
    const providerMean =
      qualities.reduce((sum, value) => sum + value, 0) / qualities.length;

    entries.forEach((entry, index) => {
      const votes = entry.rating?.votes ?? 0;
      const quality = entry.rating
        ? (entry.rating.normalized10 * votes + providerMean * 20) / (votes + 20)
        : 5;
      const relevance = 1 - entry.relevanceRank / maxRank;
      const popularity = normalized(
        popularities[index]!,
        minPopularity,
        maxPopularity,
      );
      scores.set(entry, {
        tier: titleTier(entry, query),
        score: relevance * 0.6 + popularity * 0.25 + (quality / 10) * 0.15,
        votes,
      });
    });
  });

  return [...results].sort((a, b) => {
    const aScore = scores.get(a)!;
    const bScore = scores.get(b)!;
    return (
      aScore.tier - bScore.tier ||
      bScore.score - aScore.score ||
      a.relevanceRank - b.relevanceRank ||
      bScore.votes - aScore.votes ||
      `${a.provider}:${a.externalId}`.localeCompare(
        `${b.provider}:${b.externalId}`,
      )
    );
  });
}
