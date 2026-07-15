import type { AxiosRequestConfig } from "axios";
import { beforeEach, describe, expect, it, vi } from "vitest";
import searchDune from "../__fixtures__/open-library-search-dune.json";
import searchWatchmen from "../__fixtures__/open-library-search-watchmen.json";
import workDune from "../__fixtures__/open-library-work-dune.json";

const providerRequest = vi.fn();

vi.mock("../services/provider-http.service", () => ({
  providerRequest: (...args: unknown[]) => providerRequest(...args),
}));

const {
  cleanSubjects,
  getWorkEditionCovers,
  openLibraryProvider,
  parseYear,
  toWorkId,
} = await import("./open-library.provider");

/** Routes each call by URL, the way the real API would. */
const respond = (responses: Record<string, unknown>) => {
  providerRequest.mockImplementation(
    (_options: unknown, config: AxiosRequestConfig) => {
      const url = config.url ?? "";
      const match = Object.entries(responses).find(([fragment]) =>
        url.includes(fragment),
      );

      if (!match) {
        return Promise.reject(new Error(`Unexpected request to ${url}`));
      }

      return Promise.resolve(match[1]);
    },
  );
};

describe("toWorkId", () => {
  it("strips the /works/ prefix and keeps the id case", () => {
    expect(toWorkId("/works/OL893415W")).toBe("OL893415W");
    expect(toWorkId("OL893415W")).toBe("OL893415W");
  });

  it("rejects edition and author keys", () => {
    expect(toWorkId("/books/OL7353617M")).toBeNull();
    expect(toWorkId("/authors/OL79034A")).toBeNull();
  });
});

describe("parseYear", () => {
  it("reads the year out of Open Library's free-form dates", () => {
    expect(parseYear("June 1965")).toBe(1965);
    expect(parseYear("1965-06-01")).toBe(1965);
    expect(parseYear("unknown")).toBeNull();
    expect(parseYear(null)).toBeNull();
  });
});

describe("cleanSubjects", () => {
  it("drops machine-generated subjects and splits genres from keywords", () => {
    const subjects = [
      ...Array.from({ length: 12 }, (_, index) => `Subject ${index}`),
      "nyt:paperback-fiction=2020-01-05",
    ];

    const { genres, keywords } = cleanSubjects(subjects);

    expect(genres).toHaveLength(10);
    expect(keywords).toEqual(["Subject 10", "Subject 11"]);
    expect([...genres, ...keywords]).not.toContain(
      "nyt:paperback-fiction=2020-01-05",
    );
  });
});

describe("openLibraryProvider.search", () => {
  beforeEach(() => {
    providerRequest.mockReset();
  });

  it("maps works, not editions, and keeps the work id exact", async () => {
    respond({ "/search.json": searchDune });

    const results = await openLibraryProvider.search({
      query: "dune",
      limit: 10,
    });

    expect(results).toHaveLength(2);

    const [dune] = results;
    expect(dune?.externalId).toBe("OL893415W");
    expect(dune?.provider).toBe("openlibrary");
    expect(dune?.mediaKind).toBe("book");
    expect(dune?.authorsOrCreators).toEqual(["Frank Herbert"]);
    expect(dune?.year).toBe(1965);
    expect(dune?.sourceUrl).toBe("https://openlibrary.org/works/OL893415W");
    expect(dune?.identifiers).toEqual([
      {
        provider: "openlibrary",
        externalId: "OL893415W",
        url: "https://openlibrary.org/works/OL893415W",
      },
    ]);
  });

  it("normalizes the 5-point rating onto the shared 0-10 scale", async () => {
    respond({ "/search.json": searchDune });

    const [dune] = await openLibraryProvider.search({
      query: "dune",
      limit: 10,
    });

    expect(dune?.rating).toEqual({
      source: "openlibrary",
      value: 4.3,
      scale: 5,
      normalized10: 8.6,
      votes: 1273,
      kind: "user",
    });
  });

  it("asks the covers service to 404 instead of serving a placeholder", async () => {
    respond({ "/search.json": searchDune });

    const [dune, messiah] = await openLibraryProvider.search({
      query: "dune",
      limit: 10,
    });

    expect(dune?.imageCandidates[0]?.url).toBe(
      "https://covers.openlibrary.org/b/id/8231856-L.jpg?default=false",
    );
    // No cover_i: the result still shows up, it just has nothing to persist.
    expect(messiah?.imageCandidates).toEqual([]);
  });

  it("routes a graphic novel to Comic and drops single issues", async () => {
    respond({ "/search.json": searchWatchmen });

    const results = await openLibraryProvider.search({
      query: "watchmen",
      limit: 10,
      mediaKind: "comic",
    });

    // The collected edition stays; "Watchmen #4" is an issue, not an item.
    expect(results).toHaveLength(1);
    expect(results[0]?.title).toBe("Watchmen");
    expect(results[0]?.mediaKind).toBe("comic");
  });

  it("keeps prose novels out of the Comic tab", async () => {
    respond({ "/search.json": searchDune });

    const results = await openLibraryProvider.search({
      query: "dune",
      limit: 10,
      mediaKind: "comic",
    });

    expect(results).toEqual([]);
  });

  it("skips a malformed doc instead of failing the whole search", async () => {
    respond({
      "/search.json": {
        docs: [{ key: "/works/OL893415W" }, ...searchDune.docs],
      },
    });

    const results = await openLibraryProvider.search({
      query: "dune",
      limit: 10,
    });

    // The title-less doc is dropped, the two good ones survive.
    expect(results.map((result) => result.externalId)).toEqual([
      "OL893415W",
      "OL27448W",
    ]);
  });
});

describe("openLibraryProvider.getDetails", () => {
  beforeEach(() => {
    providerRequest.mockReset();
  });

  it("resolves author names and the description text block", async () => {
    respond({
      "/works/OL893415W.json": workDune,
      "/authors/OL79034A.json": { name: "Frank Herbert" },
      "/ratings.json": { summary: { average: 4.3, count: 1273 } },
    });

    const details = await openLibraryProvider.getDetails("OL893415W");

    expect(details.mediaKind).toBe("book");
    expect(details.title).toBe("Dune");
    expect(details.year).toBe(1965);
    expect(details.description).toContain("desert planet Arrakis");
    expect(details.fields.people).toEqual(["Frank Herbert"]);
    expect(details.rating?.normalized10).toBe(8.6);
    expect(details.imageCandidates[0]?.url).toContain("8231856");
  });

  it("keeps the book when the ratings endpoint fails", async () => {
    respond({
      "/works/OL893415W.json": workDune,
      "/authors/OL79034A.json": { name: "Frank Herbert" },
    });

    const details = await openLibraryProvider.getDetails("OL893415W");

    expect(details.rating).toBeNull();
    expect(details.title).toBe("Dune");
  });

  it("rejects an id that is not a work key", async () => {
    respond({});

    await expect(
      openLibraryProvider.getDetails("OL7353617M"),
    ).rejects.toMatchObject({ code: "ITEM_NOT_FOUND" });
  });
});

describe("getWorkEditionCovers", () => {
  it("collects and deduplicates cover ids across editions", async () => {
    respond({
      "/works/OL893415W/editions.json": {
        entries: [
          { covers: [11, 12] },
          { covers: [12, 13] },
          { covers: [-1] },
          {},
        ],
      },
    });

    const covers = await getWorkEditionCovers("OL893415W");

    expect(covers).toHaveLength(3);
    expect(covers.map((c) => c.url)).toEqual([
      "https://covers.openlibrary.org/b/id/11-L.jpg?default=false",
      "https://covers.openlibrary.org/b/id/12-L.jpg?default=false",
      "https://covers.openlibrary.org/b/id/13-L.jpg?default=false",
    ]);
    expect(covers.every((c) => c.canPersist)).toBe(true);
  });

  it("returns nothing for an invalid work id", async () => {
    respond({});
    expect(await getWorkEditionCovers("OL7353617M")).toEqual([]);
  });
});
