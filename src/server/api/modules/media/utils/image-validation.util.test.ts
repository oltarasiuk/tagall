import { describe, expect, it } from "vitest";
import {
  isAcceptablePosterShape,
  isAllowedImageFormat,
  isAllowedImageMimeType,
} from "./image-validation.util";

describe("isAllowedImageMimeType", () => {
  it("accepts the image types we can re-encode, with parameters", () => {
    expect(isAllowedImageMimeType("image/jpeg")).toBe(true);
    expect(isAllowedImageMimeType("image/webp; charset=binary")).toBe(true);
  });

  it("rejects anything else", () => {
    expect(isAllowedImageMimeType("text/html")).toBe(false);
    expect(isAllowedImageMimeType("image/svg+xml")).toBe(false);
    expect(isAllowedImageMimeType(null)).toBe(false);
  });
});

describe("isAllowedImageFormat", () => {
  it("mirrors the MIME allowlist for what sharp actually decoded", () => {
    expect(isAllowedImageFormat("jpeg")).toBe(true);
    expect(isAllowedImageFormat("gif")).toBe(false);
    expect(isAllowedImageFormat(undefined)).toBe(false);
  });
});

describe("isAcceptablePosterShape", () => {
  it("accepts a portrait cover", () => {
    expect(isAcceptablePosterShape({ width: 600, height: 900 }, "game")).toBe(
      true,
    );
    expect(isAcceptablePosterShape({ width: 500, height: 750 }, "book")).toBe(
      true,
    );
  });

  it("rejects landscape art for books and games", () => {
    expect(isAcceptablePosterShape({ width: 1920, height: 1080 }, "game")).toBe(
      false,
    );
    expect(isAcceptablePosterShape({ width: 1200, height: 800 }, "book")).toBe(
      false,
    );
  });

  it("accepts a square board game box", () => {
    expect(
      isAcceptablePosterShape({ width: 800, height: 800 }, "board-game"),
    ).toBe(true);
    expect(
      isAcceptablePosterShape({ width: 800, height: 800 }, "film"),
    ).toBe(false);
  });

  it("rejects thumbnails and unknown dimensions", () => {
    expect(isAcceptablePosterShape({ width: 60, height: 90 }, "film")).toBe(
      false,
    );
    expect(isAcceptablePosterShape({ width: null, height: 900 }, "film")).toBe(
      false,
    );
  });
});
