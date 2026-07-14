import { describe, expect, it } from "vitest";
import {
  getParseSourceBySlug,
  getSearchSourceBySlug,
} from "./collection-routing.util";

describe("getSearchSourceBySlug", () => {
  it("routes film and serie to the video source", () => {
    expect(getSearchSourceBySlug("film")).toBe("video");
    expect(getSearchSourceBySlug("serie")).toBe("video");
  });

  it("routes manga to anilist search", () => {
    expect(getSearchSourceBySlug("manga")).toBe("manga");
  });

  it("returns null for collections without a search source yet", () => {
    expect(getSearchSourceBySlug("book")).toBeNull();
    expect(getSearchSourceBySlug("board-game")).toBeNull();
  });

  it("ignores display names, so renaming a collection cannot break routing", () => {
    expect(getSearchSourceBySlug("Film")).toBeNull();
    expect(getSearchSourceBySlug("TV Show")).toBeNull();
  });
});

describe("getParseSourceBySlug", () => {
  it("maps video collections to imdb and manga to anilist", () => {
    expect(getParseSourceBySlug("film")).toBe("imdb");
    expect(getParseSourceBySlug("serie")).toBe("imdb");
    expect(getParseSourceBySlug("manga")).toBe("anilist");
  });

  it("returns null for unsupported collections", () => {
    expect(getParseSourceBySlug("comic")).toBeNull();
  });
});
