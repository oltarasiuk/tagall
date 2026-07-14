import type { ContextType } from "../../../../types";
import type { SearchInputType, SearchResultType } from "../types";
import { SearchAnilist } from "./anilist.service";
import { searchVideoByImdb } from "./imdb-crawlee.service";
import { searchVideo } from "./tmdb.service";
import { getSearchSourceBySlug } from "../utils/collection-routing.util";

/** Video search: IMDB results first, then TMDB, deduped by parsedId. */
async function searchVideoWithImdbFirst(
  query: string,
  limit: number,
): Promise<SearchResultType[]> {
  const [imdbResults, tmdbResults] = await Promise.all([
    searchVideoByImdb(query, limit),
    searchVideo(query, limit),
  ]);

  console.log("[search] IMDB advanced search results", {
    query: query.trim(),
    count: imdbResults.length,
    ids: imdbResults.map((r) => r.parsedId),
  });

  const tmdbOnlyResults: SearchResultType[] = [];
  const seen = new Set(imdbResults.map((r) => r.parsedId));
  const merged = [...imdbResults];
  for (const r of tmdbResults) {
    if (seen.has(r.parsedId)) continue;
    seen.add(r.parsedId);
    merged.push(r);
    tmdbOnlyResults.push(r);
  }

  console.log("[search] TMDB search results (unique, not in IMDB)", {
    query: query.trim(),
    totalFromTmdb: tmdbResults.length,
    uniqueCount: tmdbOnlyResults.length,
    ids: tmdbResults.map((r) => r.parsedId),
    uniqueIds: tmdbOnlyResults.map((r) => r.parsedId),
  });

  const result = merged.slice(0, limit);

  console.log("[search] Final merged result", {
    query: query.trim(),
    count: result.length,
    ids: result.map((r) => r.parsedId),
  });

  return result;
}

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
}) => {
  const { ctx, input } = props;
  const limit = input.limit ?? 10;

  if (input.collectionId === "all") {
    const collections = await ctx.db.collection.findMany({
      where: { slug: { in: ["film", "serie", "manga"] } },
      select: { id: true, name: true, slug: true },
    });
    const collectionBySlug = Object.fromEntries(
      collections.map((c) => [c.slug, c]),
    );
    const filmCollection = collectionBySlug.film;
    const serieCollection = collectionBySlug.serie;
    const mangaCollection = collectionBySlug.manga;
    const perSourceLimit = Math.max(5, Math.ceil(limit / 2));

    const [videoResults, mangaResults] = await Promise.all([
      searchVideoWithImdbFirst(input.query, perSourceLimit),
      SearchAnilist(input.query, perSourceLimit),
    ]);

    const videoWithCollection: SearchResultType[] = videoResults.map((r) => {
      const target = r.mediaType === "movie" ? filmCollection : serieCollection;
      return {
        ...r,
        suggestedCollectionId: target?.id ?? null,
        suggestedCollectionName:
          target?.name ?? (r.mediaType === "movie" ? "Film" : "Serie"),
      };
    });
    const mangaWithCollection: SearchResultType[] = mangaResults.map((r) => ({
      ...r,
      suggestedCollectionId: mangaCollection?.id ?? null,
      suggestedCollectionName: mangaCollection?.name ?? "Manga",
    }));

    const combined = [...videoWithCollection, ...mangaWithCollection];
    combined.sort((a, b) => {
      const ra = a.rating ?? -1;
      const rb = b.rating ?? -1;
      if (rb !== ra) return rb - ra;
      const relA = a.relevanceRank ?? 999;
      const relB = b.relevanceRank ?? 999;
      if (relA !== relB) return relA - relB;
      const ya = a.year ?? 0;
      const yb = b.year ?? 0;
      return yb - ya;
    });
    return combined;
  }

  const collection = await ctx.db.collection.findUnique({
    where: { id: input.collectionId },
  });
  if (!collection) {
    throw new Error("Collection not found");
  }

  let items: SearchResultType[] = [];

  switch (getSearchSourceBySlug(collection.slug)) {
    case "video":
      items = (await searchVideoWithImdbFirst(input.query, limit)).map((r) => ({
        ...r,
        suggestedCollectionName: collection.name,
      }));
      break;
    case "manga":
      items = (await SearchAnilist(input.query, limit)).map((r) => ({
        ...r,
        suggestedCollectionName: collection.name,
      }));
      break;
    default:
      throw new Error(`No search provider for collection "${collection.slug}"`);
  }

  return items;
};
