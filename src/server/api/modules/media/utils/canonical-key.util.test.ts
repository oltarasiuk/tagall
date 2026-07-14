import { ExternalProvider } from "@prisma/client";
import { describe, expect, it } from "vitest";
import {
  buildCanonicalKey,
  isCanonicalKey,
  parseCanonicalKey,
} from "./canonical-key.util";

describe("buildCanonicalKey", () => {
  it("prefixes the external id with a lower-case provider", () => {
    expect(buildCanonicalKey(ExternalProvider.IMDB, "tt0137523")).toBe(
      "imdb:tt0137523",
    );
    expect(buildCanonicalKey(ExternalProvider.ANILIST, "30013")).toBe(
      "anilist:30013",
    );
    expect(buildCanonicalKey(ExternalProvider.BGG, "174430")).toBe("bgg:174430");
  });

  it("preserves the case of the external id", () => {
    expect(buildCanonicalKey(ExternalProvider.OPEN_LIBRARY, "OL82563W")).toBe(
      "openlibrary:OL82563W",
    );
    expect(buildCanonicalKey(ExternalProvider.GOOGLE_BOOKS, "zyTCAlFPjgYC")).toBe(
      "google-books:zyTCAlFPjgYC",
    );
  });

  it("trims surrounding whitespace but nothing else", () => {
    expect(buildCanonicalKey(ExternalProvider.VNDB, "  v17 ")).toBe("vndb:v17");
  });

  it("rejects an empty external id", () => {
    expect(() => buildCanonicalKey(ExternalProvider.IGDB, "   ")).toThrow();
  });
});

describe("parseCanonicalKey", () => {
  it("round-trips a built key", () => {
    const key = buildCanonicalKey(ExternalProvider.OPEN_LIBRARY, "OL82563W");

    expect(parseCanonicalKey(key)).toEqual({
      provider: ExternalProvider.OPEN_LIBRARY,
      externalId: "OL82563W",
    });
  });

  it("keeps colons that belong to the external id", () => {
    expect(parseCanonicalKey("hardcover:12345:6")).toEqual({
      provider: ExternalProvider.HARDCOVER,
      externalId: "12345:6",
    });
  });

  it("rejects bare and unknown-provider ids", () => {
    expect(parseCanonicalKey("tt0137523")).toBeNull();
    expect(parseCanonicalKey("comicvine:4050-1")).toBeNull();
    expect(parseCanonicalKey("imdb:")).toBeNull();
    expect(isCanonicalKey("30013")).toBe(false);
  });
});
