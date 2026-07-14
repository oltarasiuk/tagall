/**
 * Backfill script: turns legacy bare `Item.parsedId` values into canonical keys
 * ("imdb:tt0137523", "anilist:30013") and creates the matching
 * `ItemExternalIdentifier` row for every item.
 *
 * Provider is derived from the item's collection slug:
 *   film / serie  ->  IMDB
 *   manga         ->  ANILIST
 *
 * Usage:
 *   pnpm db:backfill-external-identifiers -- --dry-run
 *   pnpm db:backfill-external-identifiers
 *
 * The script is additive and resumable: items whose parsedId is already
 * canonical are skipped. It aborts before writing anything if two items would
 * collide on the same canonical key or external identifier — collisions are
 * reported, never silently merged.
 */

import { ExternalProvider, PrismaClient } from "@prisma/client";
import {
  buildCanonicalKey,
  isCanonicalKey,
} from "../src/server/api/modules/media/utils/canonical-key.util";

const isDryRun = process.argv.includes("--dry-run");

const prisma = new PrismaClient();

const PROVIDER_BY_COLLECTION_SLUG: Record<string, ExternalProvider> = {
  film: ExternalProvider.IMDB,
  serie: ExternalProvider.IMDB,
  manga: ExternalProvider.ANILIST,
};

type PlannedUpdateType = {
  itemId: string;
  title: string;
  provider: ExternalProvider;
  externalId: string;
  canonicalKey: string;
};

async function main() {
  if (isDryRun) {
    console.log("[backfill] DRY RUN — no writes will be performed\n");
  }

  const items = await prisma.item.findMany({
    select: {
      id: true,
      title: true,
      parsedId: true,
      collection: { select: { slug: true } },
    },
    orderBy: { createdAt: "asc" },
  });

  console.log(`[backfill] Found ${items.length} items\n`);

  const planned: PlannedUpdateType[] = [];
  const collisions: string[] = [];
  const unsupported: string[] = [];
  const keysInPlan = new Map<string, string>();
  let alreadyCanonical = 0;

  for (const item of items) {
    if (isCanonicalKey(item.parsedId)) {
      alreadyCanonical++;
      continue;
    }

    const provider = PROVIDER_BY_COLLECTION_SLUG[item.collection.slug];

    if (!provider) {
      unsupported.push(
        `${item.title} (${item.id}): no provider for collection "${item.collection.slug}"`,
      );
      continue;
    }

    // The legacy id was stored lower-cased; both IMDb and AniList ids are
    // case-insensitive, so it can be carried over as-is.
    const externalId = item.parsedId.trim();
    const canonicalKey = buildCanonicalKey(provider, externalId);

    const owner = keysInPlan.get(canonicalKey);
    if (owner) {
      collisions.push(
        `${canonicalKey}: items ${owner} and ${item.id} ("${item.title}")`,
      );
      continue;
    }
    keysInPlan.set(canonicalKey, item.id);

    planned.push({
      itemId: item.id,
      title: item.title,
      provider,
      externalId,
      canonicalKey,
    });
  }

  // Collisions against rows that already carry a canonical key or identifier.
  const existingKeys = await prisma.item.findMany({
    where: { parsedId: { in: planned.map((p) => p.canonicalKey) } },
    select: { id: true, parsedId: true },
  });
  for (const existing of existingKeys) {
    const owner = keysInPlan.get(existing.parsedId);
    if (owner && owner !== existing.id) {
      collisions.push(
        `${existing.parsedId}: item ${existing.id} already uses this canonical key, wanted by ${owner}`,
      );
    }
  }

  const existingIdentifiers = await prisma.itemExternalIdentifier.findMany({
    where: {
      OR: planned.map((p) => ({
        provider: p.provider,
        externalId: p.externalId,
      })),
    },
    select: { itemId: true, provider: true, externalId: true },
  });
  for (const existing of existingIdentifiers) {
    const owner = keysInPlan.get(
      buildCanonicalKey(existing.provider, existing.externalId),
    );
    if (owner && owner !== existing.itemId) {
      collisions.push(
        `${existing.provider}:${existing.externalId}: identifier already belongs to item ${existing.itemId}, wanted by ${owner}`,
      );
    }
  }

  if (unsupported.length > 0) {
    console.log(`[backfill] ${unsupported.length} items without a provider:`);
    unsupported.forEach((line) => console.log(`  - ${line}`));
    console.log("");
  }

  if (collisions.length > 0) {
    console.error(
      `[backfill] ABORTED: ${collisions.length} canonical key collisions. Nothing was written.`,
    );
    collisions.forEach((line) => console.error(`  - ${line}`));
    await prisma.$disconnect();
    process.exit(1);
  }

  console.log(
    `[backfill] Plan: ${planned.length} to migrate | ${alreadyCanonical} already canonical | ${unsupported.length} unsupported\n`,
  );

  let migrated = 0;

  for (const plan of planned) {
    if (isDryRun) {
      console.log(`[backfill] DRY  ${plan.canonicalKey} — ${plan.title}`);
      migrated++;
      continue;
    }

    await prisma.$transaction([
      prisma.item.update({
        where: { id: plan.itemId },
        data: { parsedId: plan.canonicalKey },
      }),
      prisma.itemExternalIdentifier.create({
        data: {
          itemId: plan.itemId,
          provider: plan.provider,
          externalId: plan.externalId,
          isPrimary: true,
        },
      }),
    ]);

    migrated++;
    console.log(`[backfill] OK   ${plan.canonicalKey} — ${plan.title}`);
  }

  console.log(
    `\n[backfill] Done. Migrated: ${migrated} | Skipped (canonical): ${alreadyCanonical} | Unsupported: ${unsupported.length}`,
  );

  if (isDryRun) {
    console.log("[backfill] DRY RUN — no rows were actually updated.");
  }

  await prisma.$disconnect();
}

main().catch((err) => {
  console.error("[backfill] Fatal error:", err);
  process.exitCode = 1;
  void prisma.$disconnect();
});
