import { describe, expect, it } from "vitest";
import { createProviderRegistry } from "../providers/provider-registry";
import type { MediaProviderAdapterType, ProviderNameType } from "../types";
import {
  PROVIDER_ATTRIBUTION,
  getActiveProviderAttributions,
} from "./provider-attribution.const";

function makeAdapter(
  name: ProviderNameType,
  enabled: boolean,
): MediaProviderAdapterType {
  return {
    name,
    supportedKinds: ["film"],
    enabled,
    search: () => Promise.resolve([]),
    getDetails: () => Promise.reject(new Error("not used")),
  };
}

describe("getActiveProviderAttributions", () => {
  it("credits only providers that are enabled", () => {
    const registry = createProviderRegistry([
      makeAdapter("tmdb", true),
      makeAdapter("openlibrary", true),
      makeAdapter("hardcover", false),
    ]);

    expect(
      getActiveProviderAttributions(registry).map((entry) => entry.provider),
    ).toEqual(["tmdb", "openlibrary"]);
  });

  it("keeps identity-only and separately branded sources out of the footer", () => {
    const registry = createProviderRegistry([
      makeAdapter("imdb", true),
      makeAdapter("steam", true),
      makeAdapter("google-books", true),
    ]);

    expect(getActiveProviderAttributions(registry)).toEqual([]);
  });

  it("carries the notice TMDB requires next to the credit", () => {
    expect(PROVIDER_ATTRIBUTION.tmdb.notice).toBe(
      "This product uses the TMDB API but is not endorsed or certified by TMDB.",
    );
  });
});
