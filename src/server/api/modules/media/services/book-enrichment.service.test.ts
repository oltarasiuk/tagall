import { describe, expect, it, vi } from "vitest";
import { createProviderRegistry } from "../providers/provider-registry";
import type {
  MediaProviderAdapterType,
  NormalizedItemDetailsType,
  ProviderSearchResultType,
} from "../types";
import { enrichBookDetails } from "./book-enrichment.service";

const hardcoverResult = (
  overrides: Partial<ProviderSearchResultType> = {},
): ProviderSearchResultType => ({
  provider: "hardcover",
  externalId: "12345",
  mediaKind: "book",
  title: "Dune",
  originalTitle: null,
  originalLanguage: null,
  year: 1965,
  description: "Set on Arrakis.",
  authorsOrCreators: ["Frank Herbert"],
  seriesName: "Dune",
  seriesPosition: null,
  identifiers: [{ provider: "hardcover", externalId: "12345" }],
  isbns: [],
  imageCandidates: [],
  rating: null,
  genres: ["Science Fiction"],
  keywords: ["space"],
  relevanceRank: 0,
  sourceUrl: null,
  ...overrides,
});

const openLibraryDetails = (
  overrides: Partial<NormalizedItemDetailsType> = {},
): NormalizedItemDetailsType => ({
  mediaKind: "book",
  title: "Dune",
  originalTitle: null,
  originalLanguage: null,
  year: 1965,
  description: null,
  sourceUrl: "https://openlibrary.org/works/OL893415W",
  identifiers: [{ provider: "openlibrary", externalId: "OL893415W" }],
  imageCandidates: [],
  rating: null,
  fields: { genres: ["Fiction"], keywords: [], people: ["Frank Herbert"] },
  ...overrides,
});

const registryWith = (
  search: MediaProviderAdapterType["search"],
  enabled = true,
) =>
  createProviderRegistry([
    {
      name: "hardcover",
      supportedKinds: ["book"],
      enabled,
      search,
      getDetails: () => Promise.reject(new Error("not used")),
    },
  ]);

describe("enrichBookDetails", () => {
  it("adds the counterpart identifier so both identities point at one item", async () => {
    const registry = registryWith(() => Promise.resolve([hardcoverResult()]));

    const enriched = await enrichBookDetails({
      provider: "openlibrary",
      details: openLibraryDetails(),
      registry,
    });

    expect(enriched.identifiers).toEqual([
      { provider: "openlibrary", externalId: "OL893415W" },
      { provider: "hardcover", externalId: "12345" },
    ]);
  });

  it("fills the description and series Open Library does not have", async () => {
    const registry = registryWith(() => Promise.resolve([hardcoverResult()]));

    const enriched = await enrichBookDetails({
      provider: "openlibrary",
      details: openLibraryDetails(),
      registry,
    });

    expect(enriched.description).toBe("Set on Arrakis.");
    expect(enriched.fields.series).toBe("Dune");
    expect(enriched.fields.genres).toEqual(["Fiction", "Science Fiction"]);
  });

  it("refuses a counterpart by a different author", async () => {
    const registry = registryWith(() =>
      Promise.resolve([
        hardcoverResult({ authorsOrCreators: ["Brian Herbert"] }),
      ]),
    );

    const enriched = await enrichBookDetails({
      provider: "openlibrary",
      details: openLibraryDetails(),
      registry,
    });

    expect(enriched.identifiers).toHaveLength(1);
    expect(enriched.description).toBeNull();
  });

  it("adds the book anyway when the counterpart lookup fails", async () => {
    const registry = registryWith(() => Promise.reject(new Error("503")));

    const enriched = await enrichBookDetails({
      provider: "openlibrary",
      details: openLibraryDetails(),
      registry,
    });

    expect(enriched.identifiers).toHaveLength(1);
  });

  it("skips the lookup entirely when the counterpart is not configured", async () => {
    const search = vi.fn();
    const registry = registryWith(search, false);

    await enrichBookDetails({
      provider: "openlibrary",
      details: openLibraryDetails(),
      registry,
    });

    expect(search).not.toHaveBeenCalled();
  });

  it("leaves non-book kinds alone", async () => {
    const search = vi.fn();
    const registry = registryWith(search);

    const details = openLibraryDetails({ mediaKind: "film" });
    const enriched = await enrichBookDetails({
      provider: "imdb",
      details,
      registry,
    });

    expect(enriched).toBe(details);
    expect(search).not.toHaveBeenCalled();
  });
});
