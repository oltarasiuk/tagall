import { describe, expect, it } from "vitest";
import {
  getPopularityConfidence,
  normalizeRating,
} from "./normalize-rating.util";

describe("normalizeRating", () => {
  it("projects 5, 10 and 100 point scales onto the same 0-10 axis", () => {
    expect(
      normalizeRating({ source: "hardcover", value: 4.3, scale: 5 })
        ?.normalized10,
    ).toBe(8.6);
    expect(
      normalizeRating({ source: "tmdb", value: 8.4, scale: 10 })?.normalized10,
    ).toBe(8.4);
    expect(
      normalizeRating({ source: "igdb", value: 91.5, scale: 100 })
        ?.normalized10,
    ).toBe(9.2);
  });

  it("keeps the raw value, the scale, the source and the vote count", () => {
    expect(
      normalizeRating({
        source: "bgg",
        value: 8.6,
        scale: 10,
        votes: 63_000,
        kind: "bayesian",
      }),
    ).toEqual({
      source: "bgg",
      value: 8.6,
      scale: 10,
      normalized10: 8.6,
      votes: 63_000,
      kind: "bayesian",
    });
  });

  it("rejects missing and out-of-scale values instead of clamping them", () => {
    expect(normalizeRating({ source: "rawg", value: null, scale: 5 })).toBeNull();
    expect(normalizeRating({ source: "rawg", value: 7, scale: 5 })).toBeNull();
    expect(normalizeRating({ source: "rawg", value: -1, scale: 5 })).toBeNull();
    expect(
      normalizeRating({ source: "rawg", value: Number.NaN, scale: 5 }),
    ).toBeNull();
  });
});

describe("getPopularityConfidence", () => {
  it("grows with the vote count and never exceeds 1", () => {
    const few = normalizeRating({
      source: "igdb",
      value: 95,
      scale: 100,
      votes: 12,
    });
    const many = normalizeRating({
      source: "igdb",
      value: 95,
      scale: 100,
      votes: 12_000,
    });

    expect(getPopularityConfidence(few)).toBeLessThan(
      getPopularityConfidence(many),
    );
    expect(getPopularityConfidence(many)).toBeLessThanOrEqual(1);
  });

  it("is zero without votes", () => {
    expect(
      getPopularityConfidence(
        normalizeRating({ source: "tmdb", value: 9, scale: 10 }),
      ),
    ).toBe(0);
    expect(getPopularityConfidence(null)).toBe(0);
  });
});
