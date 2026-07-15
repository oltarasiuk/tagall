import { describe, expect, it, vi } from "vitest";
import type { dbType } from "~/server/db";
import { analyzeStoredUsage } from "./stored-usage-analysis.service";

describe("analyzeStoredUsage", () => {
  it("aggregates existing rows into counts without writing anything", async () => {
    const groupBy = vi
      .fn()
      // identifiers by provider
      .mockResolvedValueOnce([
        { provider: "IGDB", _count: 5 },
        { provider: "OPEN_LIBRARY", _count: 3 },
      ])
      // primary identity by provider
      .mockResolvedValueOnce([{ provider: "IGDB", _count: 4 }])
      // items by artwork source
      .mockResolvedValueOnce([
        { artworkSource: "steamgriddb", _count: 4 },
        { artworkSource: "generated", _count: 2 },
        { artworkSource: null, _count: 1 },
      ]);
    const count = vi.fn().mockResolvedValue(2);

    const db = {
      itemExternalIdentifier: { groupBy },
      item: { groupBy, count },
    } as unknown as dbType;

    const result = await analyzeStoredUsage({ db });

    expect(result.providerIdentifierCounts).toEqual({ IGDB: 5, OPEN_LIBRARY: 3 });
    expect(result.primaryProviderCounts).toEqual({ IGDB: 4 });
    expect(result.artworkSourceCounts).toEqual({
      steamgriddb: 4,
      generated: 2,
      unknown: 1,
    });
    expect(result.generatedCoverCount).toBe(2);
    // No titles / external ids / user ids leak into the snapshot.
    expect(JSON.stringify(result)).not.toContain("title");
  });
});
