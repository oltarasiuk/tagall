import { deleteCache } from "../../../../../lib/redis";

export interface InvalidateItemCachesOptions {
  collectionsIds?: string[];
  itemId?: string;
  includeSearch?: boolean;
}

/**
 * Server-side cache invalidation utility for item-related Redis caches
 * This function coordinates deletion of related cache entries after mutations
 *
 * @param userId - User ID for scoping cache keys
 * @param options - Configuration for which caches to invalidate
 */
export async function invalidateItemCaches(
  userId: string,
  options: InvalidateItemCachesOptions = {},
): Promise<void> {
  const { itemId, includeSearch } = options;

  // Invalidate by userId only: cache keys are built with full input, so prefix must match all getUserItems for user
  await deleteCache("item", "getUserItems", { userId });
  await deleteCache("item", "getAllUserItems", { userId });
  await deleteCache("item", "getPublicUserItems");
  await deleteCache("item", "getPublicAllUserItems");
  await deleteCache("item", "getPublicRandomUserItems");

  // Invalidate stats
  await deleteCache("item", "getUserItemsStats", { userId });
  await deleteCache("item", "getPublicUserItemsStats");

  // Invalidate by userId only: cache keys use full input, prefix must match all entries for user
  await deleteCache("item", "getYearsRange", { userId });
  await deleteCache("field", "getFilterFields", { userId });
  await deleteCache("item", "getPublicYearsRange");
  await deleteCache("field", "getPublicFilterFields");
  await deleteCache("collection", "getPublicUserCollections");

  // Invalidate specific item if provided
  if (itemId) {
    await deleteCache("item", "getUserItem", {
      userId,
      input: itemId,
    });
  }

  // Invalidate search caches if requested
  if (includeSearch) {
    await deleteCache("parse", "search", { userId });
    await deleteCache("parse", "regrex", { userId });
  }

  // Always clear nearest items (no user-specific key)
  await deleteCache("item", "getNearestItems");
}
