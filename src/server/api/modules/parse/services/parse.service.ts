import type { ContextType } from "../../../../types";
import {
  getCollectionSlugForMediaKind,
  getMediaKindForCollectionSlug,
} from "../../media/constants/media-kind.const";
import { dedupeSearchResults } from "../../media/services/search-deduplication.service";
import { searchMedia } from "../../media/services/media-search.service";
import { rankSearchResults } from "../../media/services/search-ranking.service";
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

  const selectedCollectionIds =
    input.collectionId === "all" ? [] : [input.collectionId];

  const selectedCollections = selectedCollectionIds.length
    ? await ctx.db.collection.findMany({
        where: { id: { in: selectedCollectionIds } },
        select: { id: true, slug: true },
      })
    : [];

  if (selectedCollections.length !== selectedCollectionIds.length) {
    throw new Error("Collection not found");
  }

  const selectedMediaKinds = [
    ...new Set(
      selectedCollections.map((collection) => {
        const mediaKind = getMediaKindForCollectionSlug(collection.slug);

        if (!mediaKind) {
          throw new Error(
            `No search provider for collection "${collection.slug}"`,
          );
        }

        return mediaKind;
      }),
    ),
  ];

  // No selected type deliberately means an all-provider search. Otherwise we
  // only call adapters that serve the selected media kinds; this saves latency
  // and avoids spending provider rate limits on irrelevant requests.
  const searchOutputs = selectedMediaKinds.length
    ? await Promise.all(
        selectedMediaKinds.map((mediaKind) =>
          searchMedia({ query: input.query, limit, mediaKind }),
        ),
      )
    : [await searchMedia({ query: input.query, limit })];
  const results = searchOutputs.flatMap((output) => output.results);

  // One work described by two providers must reach the UI as one card: hiding
  // the duplicate in React would still let the add flow create two items.
  const merged = rankSearchResults(
    dedupeSearchResults(results),
    input.query,
  ).slice(0, limit);

  const collections = await ctx.db.collection.findMany({
    select: { id: true, name: true, slug: true },
  });
  const collectionBySlug = new Map<string, CollectionRefType>(
    collections.map((collection) => [collection.slug, collection]),
  );

  const items = merged.map((result) =>
    toLegacySearchResult(
      result,
      collectionBySlug.get(getCollectionSlugForMediaKind(result.mediaKind)) ??
        null,
    ),
  );

  return items;
};
