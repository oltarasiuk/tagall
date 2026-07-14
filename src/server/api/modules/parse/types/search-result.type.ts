import type { TmdbMediaType } from "./tmdb-media-type.type";
import type { MediaKindType, ProviderNameType } from "../../media/types";

export type SearchResultType = {
  id: string | null;
  title: string | null;
  image: string | null;
  year: number | null;
  description: string | null;
  keywords: string[];
  parsedId: string;
  /** Provider identity fields used by the server-side create flow. */
  provider: ProviderNameType;
  externalId: string;
  mediaKind: MediaKindType;
  /** Present when source is TMDB (video search). */
  mediaType?: TmdbMediaType;
  /** Target collection to add the item to (e.g. when searchAll is used). */
  suggestedCollectionId?: string | null;
  /** Display label for type: Film, Serie, Manga. */
  suggestedCollectionName?: string | null;
  /** Rating/score for sorting, 0-10 scale (TMDB vote_average, Anilist averageScore/10). */
  rating?: number | null;
  /** Lower = more relevant; used when sorting items with no rating (e.g. Anilist SEARCH_MATCH order). */
  relevanceRank?: number | null;
};
