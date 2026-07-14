import { describe, expect, it } from "vitest";
import type {
  MediaKindType,
  ProviderNameType,
  ProviderSearchResultType,
} from "../types";
import { dedupeSearchResults } from "./search-deduplication.service";

type OverridesType = Partial<ProviderSearchResultType>;

const result = (
  provider: ProviderNameType,
  externalId: string,
  overrides: OverridesType = {},
): ProviderSearchResultType => ({
  provider,
  externalId,
  mediaKind: "book" as MediaKindType,
  title: "Dune",
  originalTitle: null,
  originalLanguage: null,
  year: 1965,
  description: null,
  authorsOrCreators: ["Frank Herbert"],
  seriesName: null,
  seriesPosition: null,
  identifiers: [{ provider, externalId }],
  isbns: [],
  imageCandidates: [],
  rating: null,
  genres: [],
  keywords: [],
  relevanceRank: 0,
  sourceUrl: null,
  ...overrides,
});

describe("dedupeSearchResults", () => {
  it("merges two providers that share an ISBN", () => {
    const merged = dedupeSearchResults([
      result("openlibrary", "OL893415W", {
        isbns: ["0-441-01359-7"],
        title: "Dune Chronicles",
        authorsOrCreators: ["Somebody Else"],
      }),
      result("hardcover", "12345", { isbns: ["9780441013593"] }),
    ]);

    // A shared, checksum-valid ISBN is a fact: it merges even when the titles
    // and authors disagree.
    expect(merged).toHaveLength(1);
    expect(merged[0]?.identifiers).toEqual([
      { provider: "openlibrary", externalId: "OL893415W" },
      { provider: "hardcover", externalId: "12345" },
    ]);
  });

  it("merges on title, primary creator and year when no identifier is shared", () => {
    const merged = dedupeSearchResults([
      result("openlibrary", "OL893415W"),
      result("hardcover", "12345", { year: 1966 }),
    ]);

    expect(merged).toHaveLength(1);
    expect(merged[0]?.provider).toBe("openlibrary");
  });

  it("keeps Open Library as the identity of a merged book", () => {
    const merged = dedupeSearchResults([
      result("hardcover", "12345", { relevanceRank: 0 }),
      result("openlibrary", "OL893415W", { relevanceRank: 3 }),
    ]);

    expect(merged[0]?.provider).toBe("openlibrary");
    expect(merged[0]?.externalId).toBe("OL893415W");
    // A work two providers agree on ranks by the best of them.
    expect(merged[0]?.relevanceRank).toBe(0);
  });

  it("fills the description from Hardcover when Open Library has none", () => {
    const merged = dedupeSearchResults([
      result("openlibrary", "OL893415W"),
      result("hardcover", "12345", { description: "Set on Arrakis." }),
    ]);

    expect(merged[0]?.description).toBe("Set on Arrakis.");
  });

  it("never averages ratings: the source with more votes wins and is named", () => {
    const merged = dedupeSearchResults([
      result("openlibrary", "OL893415W", {
        rating: {
          source: "openlibrary",
          value: 4.3,
          scale: 5,
          normalized10: 8.6,
          votes: 1273,
          kind: "user",
        },
      }),
      result("hardcover", "12345", {
        rating: {
          source: "hardcover",
          value: 3,
          scale: 5,
          normalized10: 6,
          votes: 12,
          kind: "user",
        },
      }),
    ]);

    expect(merged[0]?.rating?.source).toBe("openlibrary");
    expect(merged[0]?.rating?.normalized10).toBe(8.6);
  });

  it("does not merge the same title by different authors", () => {
    const merged = dedupeSearchResults([
      result("openlibrary", "OL1W", { authorsOrCreators: ["Frank Herbert"] }),
      result("hardcover", "999", { authorsOrCreators: ["Brian Herbert"] }),
    ]);

    expect(merged).toHaveLength(2);
  });

  it("does not merge different volumes of one series", () => {
    const merged = dedupeSearchResults([
      result("openlibrary", "OL10W", {
        mediaKind: "comic",
        title: "Saga, Vol. 3",
        authorsOrCreators: ["Brian K. Vaughan"],
      }),
      result("hardcover", "500", {
        mediaKind: "comic",
        title: "Saga, Vol. 4",
        authorsOrCreators: ["Brian K. Vaughan"],
      }),
    ]);

    expect(merged).toHaveLength(2);
  });

  it("does not merge a book with a manga of the same name", () => {
    const merged = dedupeSearchResults([
      result("openlibrary", "OL20W", { title: "Monster" }),
      result("anilist", "30013", {
        title: "Monster",
        mediaKind: "manga",
        authorsOrCreators: ["Frank Herbert"],
      }),
    ]);

    expect(merged).toHaveLength(2);
  });

  it("does not merge a visual novel with a comic of the same name", () => {
    const merged = dedupeSearchResults([
      result("vndb", "v17", {
        mediaKind: "visual-novel",
        title: "Ever17",
        authorsOrCreators: ["KID"],
      }),
      result("openlibrary", "OL40W", {
        mediaKind: "comic",
        title: "Ever17",
        authorsOrCreators: ["KID"],
      }),
    ]);

    expect(merged).toHaveLength(2);
  });

  it("ignores an ISBN that fails its checksum", () => {
    const merged = dedupeSearchResults([
      result("openlibrary", "OL30W", {
        isbns: ["9780441013599"],
        title: "One Book",
        authorsOrCreators: ["A"],
      }),
      result("hardcover", "777", {
        isbns: ["9780441013599"],
        title: "Another Book",
        authorsOrCreators: ["B"],
      }),
    ]);

    expect(merged).toHaveLength(2);
  });

  it("collapses the same work reported twice by one provider", () => {
    const merged = dedupeSearchResults([
      result("openlibrary", "OL893415W"),
      result("openlibrary", "OL893415W"),
    ]);

    expect(merged).toHaveLength(1);
  });
});
