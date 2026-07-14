import { z } from "zod";

/**
 * The Hardcover API is in beta and its GraphQL schema moves. Everything here is
 * optional and unknown keys pass through: a field that changes shape must cost
 * one book, not the whole search.
 */

export const HardcoverSearchDocumentSchema = z.object({
  id: z.union([z.string(), z.number()]),
  slug: z.string().optional().nullable(),
  title: z.string().optional().nullable(),
  subtitle: z.string().optional().nullable(),
  author_names: z.array(z.string()).optional().nullable(),
  description: z.string().optional().nullable(),
  release_year: z.coerce.number().optional().nullable(),
  rating: z.coerce.number().optional().nullable(),
  ratings_count: z.coerce.number().optional().nullable(),
  genres: z.array(z.string()).optional().nullable(),
  moods: z.array(z.string()).optional().nullable(),
  tags: z.array(z.string()).optional().nullable(),
  isbns: z.array(z.string()).optional().nullable(),
  series_names: z.array(z.string()).optional().nullable(),
  compilation: z.boolean().optional().nullable(),
  image: z
    .object({ url: z.string().optional().nullable() })
    .optional()
    .nullable(),
});

export type HardcoverSearchDocumentType = z.infer<
  typeof HardcoverSearchDocumentSchema
>;

export const HardcoverSearchResponseSchema = z.object({
  data: z
    .object({
      search: z
        .object({
          results: z
            .object({ hits: z.array(z.unknown()).optional().nullable() })
            .optional()
            .nullable(),
        })
        .optional()
        .nullable(),
    })
    .optional()
    .nullable(),
});

/** cached_tags is a jsonb blob: { Genre: [{ tag: "Fantasy" }], Mood: [...] }. */
const HardcoverCachedTagsSchema = z
  .record(
    z.array(z.object({ tag: z.string().optional().nullable() }).passthrough()),
  )
  .optional()
  .nullable();

export const HardcoverBookSchema = z.object({
  id: z.union([z.string(), z.number()]),
  slug: z.string().optional().nullable(),
  title: z.string(),
  subtitle: z.string().optional().nullable(),
  description: z.string().optional().nullable(),
  release_year: z.coerce.number().optional().nullable(),
  rating: z.coerce.number().optional().nullable(),
  ratings_count: z.coerce.number().optional().nullable(),
  compilation: z.boolean().optional().nullable(),
  image: z
    .object({ url: z.string().optional().nullable() })
    .optional()
    .nullable(),
  contributions: z
    .array(
      z.object({
        author: z
          .object({ name: z.string().optional().nullable() })
          .optional()
          .nullable(),
      }),
    )
    .optional()
    .nullable(),
  book_series: z
    .array(
      z.object({
        position: z.coerce.number().optional().nullable(),
        series: z
          .object({ name: z.string().optional().nullable() })
          .optional()
          .nullable(),
      }),
    )
    .optional()
    .nullable(),
  cached_tags: HardcoverCachedTagsSchema,
});

export type HardcoverBookType = z.infer<typeof HardcoverBookSchema>;

export const HardcoverBookResponseSchema = z.object({
  data: z
    .object({ books: z.array(z.unknown()).optional().nullable() })
    .optional()
    .nullable(),
});

/** Pulls one category out of cached_tags, e.g. "Genre" or "Tag". */
export const tagsOf = (
  cachedTags: HardcoverBookType["cached_tags"],
  category: string,
): string[] =>
  (cachedTags?.[category] ?? [])
    .map((entry) => entry.tag?.trim())
    .filter((tag): tag is string => !!tag);
