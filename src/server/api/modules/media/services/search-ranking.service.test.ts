import { describe, expect, it } from "vitest";
import type { ProviderSearchResultType } from "../types";
import { rankSearchResults } from "./search-ranking.service";

const result = (
  props: Partial<ProviderSearchResultType>,
): ProviderSearchResultType => ({
  provider: "openlibrary",
  externalId: "1",
  mediaKind: "book",
  title: "Dune",
  originalTitle: null,
  originalLanguage: null,
  year: null,
  description: null,
  authorsOrCreators: [],
  seriesName: null,
  seriesPosition: null,
  identifiers: [],
  isbns: [],
  imageCandidates: [],
  rating: null,
  genres: [],
  keywords: [],
  relevanceRank: 0,
  sourceUrl: null,
  ...props,
});

describe("rankSearchResults", () => {
  it("always puts an exact title ahead of a popular loose match", () => {
    const ranked = rankSearchResults(
      [
        result({
          externalId: "popular",
          title: "Dune: The TV Series",
          relevanceRank: 0,
          popularity: {
            source: "openlibrary",
            kind: "readers",
            value: 1_000_000,
          },
        }),
        result({ externalId: "exact", title: "Dune", relevanceRank: 5 }),
      ],
      "Dune",
    );

    expect(ranked.map((item) => item.externalId)).toEqual(["exact", "popular"]);
  });

  it("uses a stable provider/id tie breaker", () => {
    const ranked = rankSearchResults(
      [result({ externalId: "b" }), result({ externalId: "a" })],
      "Dune",
    );

    expect(ranked.map((item) => item.externalId)).toEqual(["a", "b"]);
  });
});
