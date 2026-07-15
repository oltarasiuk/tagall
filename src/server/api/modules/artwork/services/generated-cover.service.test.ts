import { describe, expect, it, vi } from "vitest";
import sharp from "sharp";
import { generateCoverBuffer } from "./generated-cover.service";

describe("generateCoverBuffer", () => {
  it("renders a 600x900 WebP cover", async () => {
    const buffer = await generateCoverBuffer({
      canonicalKey: "openlibrary:OL1W",
      title: "Dune",
      mediaKind: "book",
    });

    const meta = await sharp(buffer).metadata();
    expect(meta.format).toBe("webp");
    expect(meta.width).toBe(600);
    expect(meta.height).toBe(900);
  });

  it("is deterministic for one canonical key and differs for another", async () => {
    const [a1, a2, b] = await Promise.all([
      generateCoverBuffer({ canonicalKey: "igdb:1", title: "A", mediaKind: "game" }),
      generateCoverBuffer({ canonicalKey: "igdb:1", title: "A", mediaKind: "game" }),
      generateCoverBuffer({ canonicalKey: "igdb:2", title: "A", mediaKind: "game" }),
    ]);

    expect(a1.equals(a2)).toBe(true);
    expect(a1.equals(b)).toBe(false);
  });

  it("safely wraps long titles with XML-special characters", async () => {
    const buffer = await generateCoverBuffer({
      canonicalKey: "bgg:174430",
      title:
        "Gloomhaven <script> & \"Jaws of the Lion\" — an extremely long board game title that must wrap over several lines without overflowing",
      mediaKind: "board-game",
    });

    const meta = await sharp(buffer).metadata();
    expect(meta.width).toBe(600);
  });

  it("performs no external HTTP request", async () => {
    const fetchSpy = vi.fn();
    vi.stubGlobal("fetch", fetchSpy);

    await generateCoverBuffer({
      canonicalKey: "vndb:v17",
      title: "Steins;Gate",
      mediaKind: "visual-novel",
    });

    expect(fetchSpy).not.toHaveBeenCalled();
    vi.unstubAllGlobals();
  });
});
