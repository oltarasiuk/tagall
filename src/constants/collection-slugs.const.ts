import { z } from "zod";

export const COLLECTION_SLUGS = [
  "film",
  "serie",
  "book",
  "manga",
  "comic",
  "game",
  "board-game",
] as const;

export type CollectionSlugType = (typeof COLLECTION_SLUGS)[number];

export const collectionSlugSchema = z.enum(COLLECTION_SLUGS);

export const isCollectionSlug = (value: string): value is CollectionSlugType =>
  collectionSlugSchema.safeParse(value).success;
