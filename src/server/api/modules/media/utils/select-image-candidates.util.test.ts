import { describe, expect, it } from "vitest";
import type { ImageCandidateType, ProviderNameType } from "../types";
import {
  MAX_IMAGE_ATTEMPTS,
  selectImageCandidates,
} from "./select-image-candidates.util";

const candidate = (
  source: ProviderNameType,
  overrides: Partial<ImageCandidateType> = {},
): ImageCandidateType => ({
  source,
  url: `https://${HOST_BY_SOURCE[source]}/cover.jpg`,
  width: 600,
  height: 900,
  language: null,
  likes: null,
  kind: "cover",
  canPersist: true,
  ...overrides,
});

const HOST_BY_SOURCE: Partial<Record<ProviderNameType, string>> = {
  steamgriddb: "cdn2.steamgriddb.com",
  igdb: "images.igdb.com",
  rawg: "media.rawg.io",
  openlibrary: "covers.openlibrary.org",
  hardcover: "covers.openlibrary.org",
  "google-books": "books.google.com",
};

describe("selectImageCandidates", () => {
  it("prefers the Steam-oriented portrait cover for games", () => {
    const selected = selectImageCandidates(
      [candidate("rawg"), candidate("igdb"), candidate("steamgriddb")],
      "game",
    );

    expect(selected.map((c) => c.source)).toEqual([
      "steamgriddb",
      "igdb",
      "rawg",
    ]);
  });

  it("drops candidates the provider forbids storing", () => {
    const selected = selectImageCandidates(
      [candidate("google-books", { canPersist: false }), candidate("openlibrary")],
      "book",
    );

    expect(selected.map((c) => c.source)).toEqual(["openlibrary"]);
  });

  it("drops candidates hosted outside the allowlist", () => {
    const selected = selectImageCandidates(
      [candidate("openlibrary", { url: "https://evil.com/cover.jpg" })],
      "book",
    );

    expect(selected).toEqual([]);
  });

  it("keeps a banner grid behind a real cover", () => {
    const selected = selectImageCandidates(
      [
        candidate("steamgriddb", { kind: "grid" }),
        candidate("steamgriddb", { kind: "cover" }),
      ],
      "game",
    );

    expect(selected[0]?.kind).toBe("cover");
  });

  it("prefers English, then higher resolution", () => {
    const selected = selectImageCandidates(
      [
        candidate("openlibrary", { language: "de", width: 1000, height: 1500 }),
        candidate("openlibrary", { language: "en", width: 400, height: 600 }),
      ],
      "book",
    );

    expect(selected[0]?.language).toBe("en");
  });

  it("never hands the pipeline more than three attempts", () => {
    const selected = selectImageCandidates(
      [
        candidate("igdb"),
        candidate("steamgriddb"),
        candidate("rawg"),
        candidate("igdb", { width: 500, height: 750 }),
      ],
      "game",
    );

    expect(selected).toHaveLength(MAX_IMAGE_ATTEMPTS);
  });
});
