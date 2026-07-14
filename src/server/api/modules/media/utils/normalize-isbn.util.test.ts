import { describe, expect, it } from "vitest";
import { normalizeIsbn, normalizeIsbns } from "./normalize-isbn.util";

describe("normalizeIsbn", () => {
  it("lifts a valid ISBN-10 to the ISBN-13 it denotes", () => {
    expect(normalizeIsbn("0-441-01359-7")).toBe("9780441013593");
  });

  it("accepts the X check digit", () => {
    expect(normalizeIsbn("043942089X")).toBe("9780439420891");
  });

  it("keeps a valid ISBN-13 as is", () => {
    expect(normalizeIsbn("978-0-441-01359-3")).toBe("9780441013593");
  });

  it("rejects a wrong checksum instead of merging two unrelated works", () => {
    expect(normalizeIsbn("9780441013599")).toBeNull();
    expect(normalizeIsbn("0441013590")).toBeNull();
  });

  it("rejects anything that is not an ISBN", () => {
    expect(normalizeIsbn("OL893415W")).toBeNull();
    expect(normalizeIsbn("")).toBeNull();
    expect(normalizeIsbn(null)).toBeNull();
  });
});

describe("normalizeIsbns", () => {
  it("deduplicates the ISBN-10 and ISBN-13 of one edition", () => {
    expect(
      normalizeIsbns(["0441013597", "9780441013593", "not-an-isbn"]),
    ).toEqual(["9780441013593"]);
  });
});
