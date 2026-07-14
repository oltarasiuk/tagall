import { describe, expect, it } from "vitest";
import { MediaError } from "../errors/media.error";
import { createProviderRegistry } from "../providers/provider-registry";
import type {
  MediaKindType,
  MediaProviderAdapterType,
  ProviderNameType,
  ProviderSearchResultType,
} from "../types";
import { searchMedia } from "./media-search.service";

function makeResult(
  provider: ProviderNameType,
  externalId: string,
  mediaKind: MediaKindType,
): ProviderSearchResultType {
  return {
    provider,
    externalId,
    mediaKind,
    title: externalId,
    originalTitle: null,
    originalLanguage: null,
    year: null,
    description: null,
    authorsOrCreators: [],
    seriesName: null,
    seriesPosition: null,
    identifiers: [{ provider, externalId }],
    imageCandidates: [],
    rating: null,
    genres: [],
    keywords: [],
    relevanceRank: 0,
    sourceUrl: null,
  };
}

function makeAdapter(props: {
  name: ProviderNameType;
  supportedKinds: MediaKindType[];
  enabled?: boolean;
  search?: MediaProviderAdapterType["search"];
}): MediaProviderAdapterType {
  const { name, supportedKinds, enabled = true } = props;

  return {
    name,
    supportedKinds,
    enabled,
    search:
      props.search ??
      (() => Promise.resolve([makeResult(name, "1", supportedKinds[0]!)])),
    getDetails: () => Promise.reject(new Error("not used")),
  };
}

describe("searchMedia", () => {
  it("keeps the results of healthy providers when one fails", async () => {
    const registry = createProviderRegistry([
      makeAdapter({ name: "openlibrary", supportedKinds: ["book"] }),
      makeAdapter({
        name: "hardcover",
        supportedKinds: ["book"],
        search: () =>
          Promise.reject(
            new MediaError("PROVIDER_AUTH_FAILED", "bad token", {
              provider: "hardcover",
            }),
          ),
      }),
    ]);

    const { results, providerErrors } = await searchMedia({
      query: "dune",
      limit: 10,
      mediaKind: "book",
      registry,
    });

    expect(results.map((r) => r.provider)).toEqual(["openlibrary"]);
    expect(providerErrors).toEqual([
      {
        provider: "hardcover",
        code: "PROVIDER_AUTH_FAILED",
        message: "bad token",
      },
    ]);
  });

  it("skips disabled providers", async () => {
    const registry = createProviderRegistry([
      makeAdapter({ name: "openlibrary", supportedKinds: ["book"] }),
      makeAdapter({
        name: "hardcover",
        supportedKinds: ["book"],
        enabled: false,
      }),
    ]);

    const { results } = await searchMedia({
      query: "dune",
      limit: 10,
      mediaKind: "book",
      registry,
    });

    expect(results.map((r) => r.provider)).toEqual(["openlibrary"]);
  });

  it("only calls providers that support the requested kind", async () => {
    const calls: ProviderNameType[] = [];
    const trackingAdapter = (
      name: ProviderNameType,
      kinds: MediaKindType[],
    ): MediaProviderAdapterType =>
      makeAdapter({
        name,
        supportedKinds: kinds,
        search: () => {
          calls.push(name);
          return Promise.resolve([makeResult(name, "1", kinds[0]!)]);
        },
      });

    const registry = createProviderRegistry([
      trackingAdapter("igdb", ["game"]),
      trackingAdapter("openlibrary", ["book"]),
    ]);

    await searchMedia({ query: "witcher", limit: 10, mediaKind: "game", registry });

    expect(calls).toEqual(["igdb"]);
  });

  it("returns nothing rather than throwing when no provider serves the kind", async () => {
    const registry = createProviderRegistry([
      makeAdapter({ name: "igdb", supportedKinds: ["game"] }),
    ]);

    await expect(
      searchMedia({ query: "dune", limit: 10, mediaKind: "board-game", registry }),
    ).resolves.toEqual({ results: [], providerErrors: [] });
  });
});
