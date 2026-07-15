import type { dbType } from "~/server/db";
import type { StoredUsageResult } from "../types/health.type";

const toCounts = <T extends string>(
  rows: { _count: number }[],
  key: (row: { _count: number }) => T | null | undefined,
): Record<string, number> => {
  const counts: Record<string, number> = {};
  for (const row of rows) {
    const label = key(row) ?? "unknown";
    counts[label] = row._count;
  }
  return counts;
};

/**
 * Honest, on-demand snapshot of what is already persisted — no passive metrics,
 * no simulated history, no writes back. A few bounded aggregate queries over
 * existing rows. Deliberately returns counts only: no titles, external ids or
 * user ids ever leave here.
 */
export async function analyzeStoredUsage(props: {
  db: dbType;
}): Promise<StoredUsageResult> {
  const { db } = props;

  const [byProvider, byPrimaryProvider, byArtworkSource, generatedCoverCount] =
    await Promise.all([
      db.itemExternalIdentifier.groupBy({
        by: ["provider"],
        _count: true,
      }),
      db.itemExternalIdentifier.groupBy({
        by: ["provider"],
        where: { isPrimary: true },
        _count: true,
      }),
      db.item.groupBy({
        by: ["artworkSource"],
        _count: true,
      }),
      db.item.count({ where: { artworkSource: "generated" } }),
    ]);

  return {
    generatedAt: new Date().toISOString(),
    providerIdentifierCounts: toCounts(
      byProvider,
      (row) => (row as { provider?: string }).provider,
    ),
    primaryProviderCounts: toCounts(
      byPrimaryProvider,
      (row) => (row as { provider?: string }).provider,
    ),
    artworkSourceCounts: toCounts(
      byArtworkSource,
      (row) => (row as { artworkSource?: string | null }).artworkSource,
    ),
    generatedCoverCount,
  };
}
