import { describe, expect, it } from "vitest";
import { createProviderRegistry } from "../../media/providers/provider-registry";
import type {
  MediaKindType,
  MediaProviderAdapterType,
  ProviderNameType,
} from "../../media/types";
import { resolveAddSource } from "./resolve-add-source.util";

const adapter = (
  name: ProviderNameType,
  supportedKinds: MediaKindType[],
  enabled = true,
): MediaProviderAdapterType => ({
  name,
  supportedKinds,
  enabled,
  search: () => Promise.resolve([]),
  getDetails: () => Promise.reject(new Error("not used")),
});

const registry = createProviderRegistry([
  adapter("openlibrary", ["book"]),
  adapter("hardcover", ["book"]),
  adapter("imdb", ["film", "serie"]),
  adapter("anilist", ["manga"], false),
]);

describe("resolveAddSource", () => {
  it("reads the provider off the canonical key", () => {
    expect(
      resolveAddSource({
        parsedId: "hardcover:12345",
        collectionSlug: "book",
        registry,
      }),
    ).toEqual({ provider: "hardcover", externalId: "12345" });
  });

  it("keeps the external id byte-exact", () => {
    expect(
      resolveAddSource({
        parsedId: "openlibrary:OL893415W",
        collectionSlug: "book",
        registry,
      }).externalId,
    ).toBe("OL893415W");
  });

  it("does not guess the provider from the collection when the key names one", () => {
    // "book" has two providers; the key decides which, so the second one is
    // reachable at all.
    const source = resolveAddSource({
      parsedId: "hardcover:12345",
      collectionSlug: "book",
      registry,
    });

    expect(source.provider).not.toBe("openlibrary");
  });

  it("falls back to the collection's provider for a bare id", () => {
    expect(
      resolveAddSource({
        parsedId: "tt0137523",
        collectionSlug: "film",
        registry,
      }),
    ).toEqual({ provider: "imdb", externalId: "tt0137523" });
  });

  it("refuses a key whose provider is disabled", () => {
    expect(() =>
      resolveAddSource({
        parsedId: "anilist:30013",
        collectionSlug: "manga",
        registry,
      }),
    ).toThrowError(/not available/);
  });

  it("refuses a collection no provider answers for", () => {
    expect(() =>
      resolveAddSource({
        parsedId: "174430",
        collectionSlug: "board-game",
        registry,
      }),
    ).toThrowError(/No enabled provider/);
  });
});
