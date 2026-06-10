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

  const deletions: Promise<void>[] = [
    // Invalidate by userId only: cache keys are built with full input, so prefix must match all getUserItems for user
    deleteCache("item", "getUserItems", { userId }),
    deleteCache("item", "getAllUserItems", { userId }),
    deleteCache("item", "getPublicUserItems"),
    deleteCache("item", "getPublicAllUserItems"),
    deleteCache("item", "getPublicRandomUserItems"),

    // Invalidate stats
    deleteCache("item", "getUserItemsStats", { userId }),
    deleteCache("item", "getPublicUserItemsStats"),

    // Invalidate by userId only: cache keys use full input, prefix must match all entries for user
    deleteCache("item", "getYearsRange", { userId }),
    deleteCache("field", "getFilterFields", { userId }),
    deleteCache("item", "getPublicYearsRange"),
    deleteCache("field", "getPublicFilterFields"),
    deleteCache("collection", "getPublicUserCollections"),

    // Always clear nearest items
    deleteCache("item", "getNearestItems"),
  ];

  // Invalidate specific item if provided
  if (itemId) {
    deletions.push(
      deleteCache("item", "getUserItem", {
        userId,
        input: itemId,
      }),
    );
  }

  // Invalidate search caches if requested
  if (includeSearch) {
    deletions.push(deleteCache("parse", "search", { userId }));
    deletions.push(deleteCache("parse", "regrex", { userId }));
  }

  await Promise.all(deletions);
}
