import { z } from "zod";

export const SearchInputSchema = z.object({
  query: z.string().min(1).max(100),
  /** Optional multi-select used by Add. An empty array means every media type. */
  collectionIds: z.array(z.string().cuid()).max(20).optional(),
  // Kept while older callers use the single-collection search contract.
  collectionId: z.union([z.string().cuid(), z.literal("all")]),
  limit: z.number().int().min(1).max(30).optional(),
  isAdvancedSearch: z.boolean().optional(),
});
