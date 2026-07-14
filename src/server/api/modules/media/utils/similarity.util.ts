import {
  extractVolumeNumbers,
  normalizeCreator,
  normalizeTitle,
  normalizeTitleLoose,
} from "./normalize-title.util";

/**
 * The predicates the merge step is allowed to use. They are intentionally
 * strict: a false merge silently destroys an item (two books become one), while
 * a missed merge only shows a duplicate card. Fuzzy title distance is not used
 * anywhere — "Dune" and "Dune Messiah" are one edit apart and are not the same
 * book.
 */

export const isSameTitle = (a: string, b: string): boolean => {
  const left = normalizeTitle(a);
  const right = normalizeTitle(b);

  if (!left || !right) {
    return false;
  }

  return (
    left === right || normalizeTitleLoose(a) === normalizeTitleLoose(b)
  );
};

/** True when both sides name a creator and their primary ones agree. */
export const isSamePrimaryCreator = (
  a: readonly string[],
  b: readonly string[],
): boolean => {
  const left = normalizeCreator(a[0]);
  const right = normalizeCreator(b[0]);

  if (!left || !right) {
    return false;
  }

  return left === right;
};

/** A year is missing on one side, or the two are within a year of each other. */
export const isCompatibleYear = (
  a: number | null,
  b: number | null,
  tolerance = 1,
): boolean => {
  if (a == null || b == null) {
    return true;
  }

  return Math.abs(a - b) <= tolerance;
};

/**
 * Volume 3 and volume 4 of the same series must never merge. A numbered title
 * against an unnumbered one is left alone too: the collected edition is not
 * volume 1.
 */
export const hasConflictingVolume = (a: string, b: string): boolean => {
  const left = extractVolumeNumbers(a);
  const right = extractVolumeNumbers(b);

  if (left.length === 0 && right.length === 0) {
    return false;
  }

  if (left.length === 0 || right.length === 0) {
    return true;
  }

  return left.join(",") !== right.join(",");
};

/** Two lists overlap, or one of them has nothing to say. */
export const hasCompatibleOverlap = (
  a: readonly string[],
  b: readonly string[],
): boolean => {
  if (a.length === 0 || b.length === 0) {
    return true;
  }

  const left = new Set(a.map((value) => value.toLowerCase()));

  return b.some((value) => left.has(value.toLowerCase()));
};
