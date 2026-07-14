import { describe, expect, it } from "vitest";
import {
  getCollectionSlugForMediaKind,
  getMediaKindForCollectionSlug,
  isMediaKindAllowedInCollection,
} from "./media-kind.const";

describe("getCollectionSlugForMediaKind", () => {
  it("stores visual novels in the comic collection", () => {
    expect(getCollectionSlugForMediaKind("visual-novel")).toBe("comic");
  });

  it("maps every other kind onto its own collection", () => {
    expect(getCollectionSlugForMediaKind("film")).toBe("film");
    expect(getCollectionSlugForMediaKind("board-game")).toBe("board-game");
  });
});

describe("getMediaKindForCollectionSlug", () => {
  it("routes by slug, so renaming a collection cannot break search", () => {
    expect(getMediaKindForCollectionSlug("serie")).toBe("serie");
    expect(getMediaKindForCollectionSlug("board-game")).toBe("board-game");
    expect(getMediaKindForCollectionSlug("Serie")).toBeNull();
    expect(getMediaKindForCollectionSlug("TV Show")).toBeNull();
  });
});

describe("isMediaKindAllowedInCollection", () => {
  it("accepts a visual novel in comic but not in book", () => {
    expect(isMediaKindAllowedInCollection("visual-novel", "comic")).toBe(true);
    expect(isMediaKindAllowedInCollection("visual-novel", "book")).toBe(false);
  });

  it("rejects a film in the serie collection", () => {
    expect(isMediaKindAllowedInCollection("film", "serie")).toBe(false);
    expect(isMediaKindAllowedInCollection("film", "film")).toBe(true);
  });
});
