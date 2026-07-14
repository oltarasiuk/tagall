import { describe, expect, it } from "vitest";
import { matchesBookTitle } from "./filter-book-results.util";

describe("matchesBookTitle", () => {
  it("matches only title keys, never a metadata year or subject", () => {
    expect(
      matchesBookTitle(
        { title: "Brave New World", originalTitle: null, alternateTitles: [] },
        "1984",
      ),
    ).toBe(false);
  });

  it("accepts a provider alternate title", () => {
    expect(
      matchesBookTitle(
        { title: "Nineteen Eighty-Four", originalTitle: null, alternateTitles: ["1984"] },
        "1984",
      ),
    ).toBe(true);
  });
});
