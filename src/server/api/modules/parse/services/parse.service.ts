import type { ContextType } from "../../../../types";
import {
  getCollectionSlugForMediaKind,
  getMediaKindForCollectionSlug,
} from "../../media/constants/media-kind.const";
import { searchMedia } from "../../media/services/media-search.service";
import {
  toLegacySearchResult,
  type CollectionRefType,
} from "../../media/utils/to-legacy-search-result.util";
import type { SearchInputType, SearchResultType } from "../types";

export const AddIdToSearchResults = async (props: {
  ctx: ContextType;
  items: SearchResultType[];
}) => {
  const { ctx, items } = props;

  const userItems = await ctx.db.userToItem.findMany({
    where: {
      userId: ctx.session.user.id,
      item: {
        parsedId: {
          in: items.map((item) => item.parsedId),
        },
      },
    },
    select: {
      item: {
        select: {
          id: true,
          parsedId: true,
        },
      },
    },
  });

  const itemsMap = userItems.reduce(
    (acc, userItem) => {
      acc[userItem.item.parsedId] = userItem.item.id;
      return acc;
    },
    {} as Record<string, string>,
  );

  return items.map((item) => {
    return {
      ...item,
      id: itemsMap[item.parsedId] ?? null,
    };
  });
};

export const Search = async (props: {
  ctx: ContextType;
  input: SearchInputType;
}): Promise<SearchResultType[]> => {
  const { ctx, input } = props;
  const limit = input.limit ?? 10;

  let mediaKind: ReturnType<typeof getMediaKindForCollectionSlug> = null;

  if (input.collectionId !== "all") {
    const collection = await ctx.db.collection.findUnique({
      where: { id: input.collectionId },
      select: { slug: true },
    });

    if (!collection) {
      throw new Error("Collection not found");
    }

    mediaKind = getMediaKindForCollectionSlug(collection.slug);

    if (!mediaKind) {
      throw new Error(`No search provider for collection "${collection.slug}"`);
    }
  }

  const { results } = await searchMedia({
    query: input.query,
    limit,
    ...(mediaKind && { mediaKind }),
  });

  const collections = await ctx.db.collection.findMany({
    select: { id: true, name: true, slug: true },
  });
  const collectionBySlug = new Map<string, CollectionRefType>(
    collections.map((collection) => [collection.slug, collection]),
  );

  const items = results.map((result) =>
    toLegacySearchResult(
      result,
      collectionBySlug.get(getCollectionSlugForMediaKind(result.mediaKind)) ??
        null,
    ),
  );

  if (mediaKind) {
    return items;
  }

  // "All" tab: providers are queried in parallel, so the merged list needs one
  // deterministic order. Ratings are already normalized to 0-10 here.
  return items.sort((a, b) => {
    const ratingA = a.rating ?? -1;
    const ratingB = b.rating ?? -1;
    if (ratingB !== ratingA) return ratingB - ratingA;

    const rankA = a.relevanceRank ?? 999;
    const rankB = b.relevanceRank ?? 999;
    if (rankA !== rankB) return rankA - rankB;

    return (b.year ?? 0) - (a.year ?? 0);
  });
};
