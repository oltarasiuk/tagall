import type { CollectionSlugType } from "~/constants";
import type { MediaKindType } from "../types";

/** Where an item of a given kind is stored. Visual novels live in Comic. */
export const COLLECTION_SLUG_BY_MEDIA_KIND: Record<
  MediaKindType,
  CollectionSlugType
> = {
  film: "film",
  serie: "serie",
  book: "book",
  manga: "manga",
  comic: "comic",
  "visual-novel": "comic",
  game: "game",
  "board-game": "board-game",
};

export const getCollectionSlugForMediaKind = (
  mediaKind: MediaKindType,
): CollectionSlugType => COLLECTION_SLUG_BY_MEDIA_KIND[mediaKind];

/**
 * The kind a collection asks providers for. Comic asks for `comic`; visual
 * novels also land there, but they are reached through the VNDB adapter rather
 * than by asking for a kind.
 */
const MEDIA_KIND_BY_COLLECTION_SLUG: Record<CollectionSlugType, MediaKindType> =
  {
    film: "film",
    serie: "serie",
    book: "book",
    manga: "manga",
    comic: "comic",
    game: "game",
    "board-game": "board-game",
  };

export const getMediaKindForCollectionSlug = (
  collectionSlug: string,
): MediaKindType | null =>
  MEDIA_KIND_BY_COLLECTION_SLUG[collectionSlug as CollectionSlugType] ?? null;

/**
 * A search result may only be stored in the collection its kind maps to.
 * The client picks the collection, so the server re-checks the pair.
 */
export const isMediaKindAllowedInCollection = (
  mediaKind: MediaKindType,
  collectionSlug: string,
): boolean => COLLECTION_SLUG_BY_MEDIA_KIND[mediaKind] === collectionSlug;
