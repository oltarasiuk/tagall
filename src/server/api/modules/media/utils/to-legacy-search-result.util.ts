import type { SearchResultType } from "../../parse/types";
import type { TmdbMediaType } from "../../parse/types/tmdb-media-type.type";
import type { MediaKindType, ProviderSearchResultType } from "../types";

export type CollectionRefType = { id: string; name: string; slug: string };

const toMediaType = (mediaKind: MediaKindType): TmdbMediaType | undefined => {
  if (mediaKind === "film") return "movie";
  if (mediaKind === "serie") return "tv";
  return undefined;
};

/**
 * Bridges the normalized provider result to the shape the current Add UI still
 * consumes. It disappears once the UI moves to `resultKey` + provider fields.
 */
export function toLegacySearchResult(
  result: ProviderSearchResultType,
  collection: CollectionRefType | null,
): SearchResultType {
  return {
    id: null,
    title: result.title,
    image: result.imageCandidates[0]?.url ?? null,
    year: result.year,
    description: result.description,
    keywords: result.keywords,
    parsedId: result.externalId,
    ...(toMediaType(result.mediaKind) && {
      mediaType: toMediaType(result.mediaKind),
    }),
    suggestedCollectionId: collection?.id ?? null,
    suggestedCollectionName: collection?.name ?? null,
    rating: result.rating?.normalized10 ?? null,
    relevanceRank: result.relevanceRank,
  };
}
