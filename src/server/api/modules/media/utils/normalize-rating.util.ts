import type {
  NormalizedRatingType,
  ProviderNameType,
} from "../types";

type NormalizeRatingInputType = {
  source: ProviderNameType;
  /** Raw value as the provider reports it. */
  value: number | null | undefined;
  /** Provider scale: 5 (Hardcover, RAWG), 10 (TMDB, BGG), 100 (IGDB, AniList). */
  scale: 5 | 10 | 100;
  votes?: number | null;
  kind?: NormalizedRatingType["kind"];
};

/**
 * Projects a provider rating onto a shared 0–10 scale, keeping the raw value,
 * its scale and the vote count. Ratings from different providers are never
 * averaged: the merge step picks one source and says which.
 */
export function normalizeRating(
  input: NormalizeRatingInputType,
): NormalizedRatingType | null {
  const { source, value, scale, votes = null, kind = "user" } = input;

  if (value == null || !Number.isFinite(value) || value < 0 || value > scale) {
    return null;
  }

  const normalized10 = Math.round((value / scale) * 10 * 10) / 10;

  return {
    source,
    value,
    scale,
    normalized10,
    votes,
    kind,
  };
}

/**
 * Confidence in a rating, 0–1: a 9.5 from 12 voters is not a 9.5 from 12,000.
 * Used for sorting, never to alter the rating itself.
 */
export function getPopularityConfidence(
  rating: NormalizedRatingType | null,
): number {
  if (!rating?.votes || rating.votes <= 0) {
    return 0;
  }

  // log10(votes) saturates at 10k votes, which is plenty for a personal tracker.
  return Math.min(1, Math.log10(rating.votes) / 4);
}
