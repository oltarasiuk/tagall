import { z } from "zod";

/** VNDB's schema is stable and documented, but every field is optional per query. */

export const VndbImageSchema = z.object({
  url: z.string().optional().nullable(),
  dims: z.array(z.number()).optional().nullable(),
  /** 0–2: how explicit the cover is. 0 is safe, 2 is explicit. */
  sexual: z.number().optional().nullable(),
  violence: z.number().optional().nullable(),
});

export const VndbTagSchema = z.object({
  name: z.string().optional().nullable(),
  rating: z.number().optional().nullable(),
  /** 0 = no spoiler, 1 = minor, 2 = major. */
  spoiler: z.number().optional().nullable(),
});

export const VndbVisualNovelSchema = z.object({
  id: z.string(),
  title: z.string().optional().nullable(),
  alttitle: z.string().optional().nullable(),
  /** Original language of the novel, e.g. "ja". */
  olang: z.string().optional().nullable(),
  released: z.string().optional().nullable(),
  description: z.string().optional().nullable(),
  image: VndbImageSchema.optional().nullable(),
  rating: z.number().optional().nullable(),
  votecount: z.number().optional().nullable(),
  platforms: z.array(z.string()).optional().nullable(),
  developers: z
    .array(z.object({ name: z.string().optional().nullable() }))
    .optional()
    .nullable(),
  tags: z.array(VndbTagSchema).optional().nullable(),
});

export type VndbVisualNovelType = z.infer<typeof VndbVisualNovelSchema>;

export const VndbResponseSchema = z.object({
  results: z.array(z.unknown()).default([]),
});
