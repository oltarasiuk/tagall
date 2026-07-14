import { z } from "zod";

export const SearchInputSchema = z.object({
  query: z.string().min(1).max(100),
  // collectionId remains supported for existing callers and shared links.
  // New callers can search several item types in one request.
  collectionId: z.union([z.string().cuid(), z.literal("all")]).optional().default("all"),
  collectionIds: z.array(z.string().cuid()).optional().default([]),
  limit: z.number().int().min(1).max(30).optional(),
  includeDiscoveryFallbacks: z.boolean().optional().default(false),
});
