import { beforeEach, describe, expect, it, vi } from "vitest";
import searchSteinsGate from "../__fixtures__/vndb-search-steins-gate.json";

const providerRequest = vi.fn();

vi.mock("../services/provider-http.service", () => ({
  providerRequest: (...args: unknown[]) => providerRequest(...args),
}));

const { cleanDescription, vndbProvider } = await import("./vndb.provider");

describe("cleanDescription", () => {
  it("removes spoilers and unwraps links", () => {
    const text = cleanDescription(
      "The [i]mad[/i] scientist. [spoiler]He dies.[/spoiler] See [url=https://vndb.org/v1]here[/url].",
    );

    expect(text).toBe("The mad scientist.  See here.");
  });

  it("returns null for an empty description", () => {
    expect(cleanDescription(null)).toBeNull();
    expect(cleanDescription("[spoiler]all of it[/spoiler]")).toBeNull();
  });
});

describe("vndbProvider.search", () => {
  beforeEach(() => {
    providerRequest.mockReset();
    providerRequest.mockResolvedValue(searchSteinsGate);
  });

  it("marks results as visual novels, not books or comics", async () => {
    const results = await vndbProvider.search({
      query: "steins gate",
      limit: 10,
    });

    expect(results[0]?.mediaKind).toBe("visual-novel");
    // The Comic tab is what asks for them, but the kind stays honest.
    expect(vndbProvider.supportedKinds).toContain("comic");
  });

  it("keeps the id exact and the original title as metadata", async () => {
    const [steinsGate] = await vndbProvider.search({
      query: "steins gate",
      limit: 10,
    });

    expect(steinsGate?.externalId).toBe("v2002");
    expect(steinsGate?.title).toBe("Steins;Gate");
    expect(steinsGate?.originalTitle).toBe("シュタインズ・ゲート");
    expect(steinsGate?.originalLanguage).toBe("ja");
    expect(steinsGate?.year).toBe(2009);
    expect(steinsGate?.sourceUrl).toBe("https://vndb.org/v2002");
  });

  it("normalizes the 10-100 rating onto the shared 0-10 scale", async () => {
    const [steinsGate] = await vndbProvider.search({
      query: "steins gate",
      limit: 10,
    });

    expect(steinsGate?.rating?.normalized10).toBe(8.9);
    expect(steinsGate?.rating?.votes).toBe(12043);
  });

  it("drops spoiler tags: they are the plot, not metadata", async () => {
    const [steinsGate] = await vndbProvider.search({
      query: "steins gate",
      limit: 10,
    });

    const tags = [...(steinsGate?.genres ?? []), ...(steinsGate?.keywords ?? [])];

    expect(tags).toEqual(["Time Travel", "Science Fiction"]);
    expect(tags).not.toContain("Protagonist Dies");
  });

  it("does not offer an explicit cover for automatic persistence", async () => {
    const results = await vndbProvider.search({
      query: "steins gate",
      limit: 10,
    });

    expect(results[0]?.imageCandidates).toHaveLength(1);
    // Flagged cover: the result still shows, but the add flow will ask for a
    // cover instead of copying this one.
    expect(results[1]?.imageCandidates).toEqual([]);
  });
});

describe("vndbProvider.getDetails", () => {
  beforeEach(() => {
    providerRequest.mockReset();
    providerRequest.mockResolvedValue({
      results: [searchSteinsGate.results[0]],
    });
  });

  it("maps developers and platforms into fields", async () => {
    const details = await vndbProvider.getDetails("v2002");

    expect(details.mediaKind).toBe("visual-novel");
    expect(details.fields.production).toEqual(["5pb.", "Nitroplus"]);
    expect(details.fields.platforms).toEqual(["win", "psv", "xb360"]);
    expect(details.fields.originalLanguage).toBe("ja");
    expect(details.identifiers).toEqual([
      {
        provider: "vndb",
        externalId: "v2002",
        url: "https://vndb.org/v2002",
      },
    ]);
  });

  it("rejects an id that is not a VNDB id", async () => {
    await expect(vndbProvider.getDetails("2002")).rejects.toMatchObject({
      code: "ITEM_NOT_FOUND",
    });
  });

  it("reports a missing novel instead of inventing one", async () => {
    providerRequest.mockResolvedValue({ results: [] });

    await expect(vndbProvider.getDetails("v999999")).rejects.toMatchObject({
      code: "ITEM_NOT_FOUND",
    });
  });
});
