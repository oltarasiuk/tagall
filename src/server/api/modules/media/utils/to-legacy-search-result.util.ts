import type { SearchResultType } from "../../parse/types";
import type { TmdbMediaType } from "../../parse/types/tmdb-media-type.type";
import type { MediaKindType, ProviderSearchResultType } from "../types";
import { toProviderEnum } from "../types/provider.type";
import { buildCanonicalKey } from "./canonical-key.util";

export type CollectionRefType = { id: string; name: string; slug: string };

const toMediaType = (mediaKind: MediaKindType): TmdbMediaType | undefined => {
  if (mediaKind === "film") return "movie";
  if (mediaKind === "serie") return "tv";
  return undefined;
};

/**
 * Bridges the normalized provider result to the shape the current Add UI still
 * consumes. It disappears once the UI moves to `resultKey` + provider fields.
 *
 * `parsedId` carries the canonical key ("openlibrary:OL893415W"), which is both
 * what `Item.parsedId` stores — so already-added items match — and how the add
 * flow learns which provider a result came from. A bare external id would be
 * ambiguous the moment two providers answer for the same media kind.
 */
export function toLegacySearchResult(
  result: ProviderSearchResultType,
  collection: CollectionRefType | null,
): SearchResultType {
  const provider = toProviderEnum(result.provider);

  if (!provider) {
    throw new Error(`Unknown provider "${result.provider}"`);
  }

  return {
    id: null,
    title: result.title,
    image: result.imageCandidates[0]?.url ?? null,
    year: result.year,
    description: result.description,
    keywords: result.keywords,
    parsedId: buildCanonicalKey(provider, result.externalId),
    provider: result.provider,
    externalId: result.externalId,
    mediaKind: result.mediaKind,
    ...(toMediaType(result.mediaKind) && {
      mediaType: toMediaType(result.mediaKind),
    }),
    suggestedCollectionId: collection?.id ?? null,
    suggestedCollectionName: collection?.name ?? null,
    rating: result.rating?.normalized10 ?? null,
    relevanceRank: result.relevanceRank,
  };
}
