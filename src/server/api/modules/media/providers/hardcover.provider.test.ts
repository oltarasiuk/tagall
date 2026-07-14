import { beforeEach, describe, expect, it, vi } from "vitest";
import bookDune from "../__fixtures__/hardcover-book-dune.json";
import searchDune from "../__fixtures__/hardcover-search-dune.json";

const providerRequest = vi.fn();

vi.mock("../services/provider-http.service", () => ({
  providerRequest: (...args: unknown[]) => providerRequest(...args),
}));

vi.mock("~/env", () => ({
  env: { HARDCOVER_API_TOKEN: "Bearer test-token" },
}));

const { hardcoverProvider } = await import("./hardcover.provider");

describe("hardcoverProvider.search", () => {
  beforeEach(() => {
    providerRequest.mockReset();
    providerRequest.mockResolvedValue(searchDune);
  });

  it("reads the typesense hits and normalizes the 5-point rating", async () => {
    const results = await hardcoverProvider.search({
      query: "dune",
      limit: 10,
    });

    expect(results).toHaveLength(1);
    expect(results[0]?.externalId).toBe("12345");
    expect(results[0]?.mediaKind).toBe("book");
    expect(results[0]?.authorsOrCreators).toEqual(["Frank Herbert"]);
    expect(results[0]?.seriesName).toBe("Dune");
    expect(results[0]?.rating?.normalized10).toBe(8.5);
    expect(results[0]?.rating?.votes).toBe(812);
  });

  it("carries the ISBNs that let the merge step match Open Library", async () => {
    const [dune] = await hardcoverProvider.search({ query: "dune", limit: 10 });

    expect(dune?.isbns).toContain("9780441013593");
  });

  it("offers its cover for display but never for persistence", async () => {
    const [dune] = await hardcoverProvider.search({ query: "dune", limit: 10 });

    // Hardcover art comes from third parties; only Open Library covers are
    // copied into our Cloudinary.
    expect(dune?.imageCandidates[0]?.canPersist).toBe(false);
  });

  it("sends the token verbatim, without a second Bearer prefix", async () => {
    await hardcoverProvider.search({ query: "dune", limit: 10 });

    const [, config] = providerRequest.mock.calls[0] as [
      unknown,
      { headers: Record<string, string> },
    ];

    expect(config.headers.authorization).toBe("Bearer test-token");
  });

  it("drops a malformed hit instead of failing the search", async () => {
    providerRequest.mockResolvedValue({
      data: {
        search: {
          results: {
            hits: [{ document: { title: "No id" } }, ...searchDune.data.search.results.hits],
          },
        },
      },
    });

    const results = await hardcoverProvider.search({
      query: "dune",
      limit: 10,
    });

    expect(results.map((result) => result.externalId)).toEqual(["12345"]);
  });
});

describe("hardcoverProvider.getDetails", () => {
  beforeEach(() => {
    providerRequest.mockReset();
    providerRequest.mockResolvedValue(bookDune);
  });

  it("maps contributions, series and cached tags", async () => {
    const details = await hardcoverProvider.getDetails("12345");

    expect(details.title).toBe("Dune");
    expect(details.year).toBe(1965);
    expect(details.fields.people).toEqual(["Frank Herbert"]);
    expect(details.fields.series).toBe("Dune");
    expect(details.fields.genres).toEqual(["Science Fiction", "Fantasy"]);
    expect(details.fields.keywords).toEqual(["space", "politics"]);
    expect(details.identifiers).toEqual([
      {
        provider: "hardcover",
        externalId: "12345",
        url: "https://hardcover.app/books/dune",
      },
    ]);
  });

  it("rejects an id that is not a Hardcover book id", async () => {
    await expect(
      hardcoverProvider.getDetails("OL893415W"),
    ).rejects.toMatchObject({ code: "ITEM_NOT_FOUND" });
  });

  it("reports a missing book instead of inventing one", async () => {
    providerRequest.mockResolvedValue({ data: { books: [] } });

    await expect(hardcoverProvider.getDetails("999")).rejects.toMatchObject({
      code: "ITEM_NOT_FOUND",
    });
  });
});
