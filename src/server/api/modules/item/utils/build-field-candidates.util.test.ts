import { describe, expect, it } from "vitest";
import {
  buildFieldCandidates,
  getFieldKey,
} from "./build-field-candidates.util";

const genres = { id: "group-genres", name: "genres" };
const keywords = { id: "group-keywords", name: "keywords" };
const runtime = { id: "group-runtime", name: "runtime" };

describe("buildFieldCandidates", () => {
  it("keeps the same value in two different groups as two candidates", () => {
    const candidates = buildFieldCandidates(
      { genres: ["Action"], keywords: ["Action"] },
      [genres, keywords],
    );

    expect(candidates).toEqual([
      { value: "action", fieldGroupId: "group-genres" },
      { value: "action", fieldGroupId: "group-keywords" },
    ]);
  });

  it("collapses repeats within one group", () => {
    const candidates = buildFieldCandidates(
      { genres: ["Action", "action", " ACTION "] },
      [genres],
    );

    expect(candidates).toEqual([
      { value: "action", fieldGroupId: "group-genres" },
    ]);
  });

  it("accepts scalar values and ignores empty or non-primitive ones", () => {
    const candidates = buildFieldCandidates(
      { runtime: 148, genres: ["", "   ", { name: "Action" }] },
      [genres, runtime],
    );

    expect(candidates).toEqual([
      { value: "148", fieldGroupId: "group-runtime" },
    ]);
  });

  it("ignores details that have no matching field group", () => {
    expect(buildFieldCandidates({ platforms: ["PC"] }, [genres])).toEqual([]);
  });
});

describe("getFieldKey", () => {
  it("scopes the key by field group, not by value alone", () => {
    expect(getFieldKey({ value: "action", fieldGroupId: "group-genres" })).not.toBe(
      getFieldKey({ value: "action", fieldGroupId: "group-keywords" }),
    );
  });
});
