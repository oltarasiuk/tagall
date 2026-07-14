/**
 * ISBNs are the only thing two book providers reliably agree on, so they are
 * the hard-match key of book deduplication. To compare them at all they must
 * first be canonical: hyphens dropped, checksum verified (a mistyped ISBN in a
 * wiki record would otherwise merge two unrelated works), ISBN-10 lifted to the
 * ISBN-13 it denotes.
 */

const clean = (value: string): string =>
  value.replace(/[\s-]/g, "").toUpperCase();

const isbn10Checksum = (digits: string): boolean => {
  let sum = 0;

  for (let index = 0; index < 9; index++) {
    sum += Number(digits[index]) * (10 - index);
  }

  const last = digits[9] === "X" ? 10 : Number(digits[9]);

  return (sum + last) % 11 === 0;
};

const isbn13Checksum = (digits: string): boolean => {
  let sum = 0;

  for (let index = 0; index < 12; index++) {
    sum += Number(digits[index]) * (index % 2 === 0 ? 1 : 3);
  }

  const check = (10 - (sum % 10)) % 10;

  return check === Number(digits[12]);
};

const toIsbn13 = (isbn10: string): string => {
  const body = `978${isbn10.slice(0, 9)}`;
  let sum = 0;

  for (let index = 0; index < 12; index++) {
    sum += Number(body[index]) * (index % 2 === 0 ? 1 : 3);
  }

  return `${body}${(10 - (sum % 10)) % 10}`;
};

/** Returns the canonical ISBN-13, or null if the input is not a valid ISBN. */
export function normalizeIsbn(value: string | null | undefined): string | null {
  if (!value) {
    return null;
  }

  const digits = clean(value);

  if (/^\d{9}[\dX]$/.test(digits)) {
    return isbn10Checksum(digits) ? toIsbn13(digits) : null;
  }

  if (/^\d{13}$/.test(digits)) {
    return isbn13Checksum(digits) ? digits : null;
  }

  return null;
}

export function normalizeIsbns(values: readonly string[]): string[] {
  const normalized = new Set<string>();

  for (const value of values) {
    const isbn = normalizeIsbn(value);

    if (isbn) {
      normalized.add(isbn);
    }
  }

  return [...normalized];
}
