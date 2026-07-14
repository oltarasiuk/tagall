/**
 * Comparison keys, never storage values. `normalizeText()` exists for field
 * values; this one is deliberately separate, because deduplication needs rules
 * that would be wrong to persist: "&" folded to "and", punctuation stripped,
 * Unicode composed.
 *
 * Volume and issue numbers survive on purpose — "Saga, Vol. 3" and "Saga, Vol.
 * 4" are different books, and dropping the digits would merge a whole shelf.
 */

const ARTICLE_PREFIX = /^(the|a|an)\s+/;

export function normalizeTitle(title: string | null | undefined): string {
  if (!title) {
    return "";
  }

  return title
    .normalize("NFKC")
    .toLowerCase()
    .replace(/&/g, " and ")
    .replace(/[’']/g, "")
    .replace(/[^\p{L}\p{N}]+/gu, " ")
    .trim()
    .replace(/\s+/g, " ");
}

/** Same title modulo a leading article: "The Hobbit" and "Hobbit". */
export function normalizeTitleLoose(title: string | null | undefined): string {
  return normalizeTitle(title).replace(ARTICLE_PREFIX, "");
}

export function normalizeCreator(name: string | null | undefined): string {
  return normalizeTitle(name);
}

/**
 * Volume/issue markers a comic title may carry. Two titles that agree on
 * everything but the number are two different volumes, so the numbers are
 * compared explicitly instead of being normalized away.
 */
export function extractVolumeNumbers(title: string | null | undefined): number[] {
  const normalized = normalizeTitle(title);
  const numbers = new Set<number>();

  for (const match of normalized.matchAll(
    /\b(?:vol|volume|book|part|no|number|issue)\s*(\d{1,4})\b/g,
  )) {
    numbers.add(Number(match[1]));
  }

  return [...numbers].sort((a, b) => a - b);
}
