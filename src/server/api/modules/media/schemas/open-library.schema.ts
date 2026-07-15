import { z } from "zod";

/**
 * Open Library is a wiki: almost every field is optional and a work may carry
 * shapes the docs do not mention. The schemas below are permissive on purpose —
 * a surprising payload must degrade one result, never the whole search.
 */

export const OpenLibrarySearchDocSchema = z.object({
  key: z.string(),
  title: z.string().optional().nullable(),
  author_name: z.array(z.string()).optional().nullable(),
  first_publish_year: z.number().optional().nullable(),
  cover_i: z.number().optional().nullable(),
  isbn: z.array(z.string()).optional().nullable(),
  subject: z.array(z.string()).optional().nullable(),
  ratings_average: z.number().optional().nullable(),
  ratings_count: z.number().optional().nullable(),
  language: z.array(z.string()).optional().nullable(),
  publisher: z.array(z.string()).optional().nullable(),
});

export type OpenLibrarySearchDocType = z.infer<typeof OpenLibrarySearchDocSchema>;

export const OpenLibrarySearchResponseSchema = z.object({
  docs: z.array(z.unknown()).default([]),
});

/** Open Library writes descriptions either as a plain string or as a typed text block. */
const OpenLibraryTextSchema = z.union([
  z.string(),
  z.object({ value: z.string() }),
]);

export const OpenLibraryWorkSchema = z.object({
  key: z.string(),
  title: z.string(),
  description: OpenLibraryTextSchema.optional().nullable(),
  subjects: z.array(z.string()).optional().nullable(),
  subject_places: z.array(z.string()).optional().nullable(),
  subject_people: z.array(z.string()).optional().nullable(),
  covers: z.array(z.number()).optional().nullable(),
  first_publish_date: z.string().optional().nullable(),
  authors: z
    .array(
      z.object({
        author: z.object({ key: z.string() }).optional().nullable(),
      }),
    )
    .optional()
    .nullable(),
});

export type OpenLibraryWorkType = z.infer<typeof OpenLibraryWorkSchema>;

export const OpenLibraryEditionsSchema = z.object({
  entries: z
    .array(
      z.object({
        covers: z.array(z.number()).optional().nullable(),
      }),
    )
    .optional()
    .nullable(),
});

export const OpenLibraryAuthorSchema = z.object({
  name: z.string().optional().nullable(),
});

export const OpenLibraryRatingsSchema = z.object({
  summary: z
    .object({
      average: z.number().optional().nullable(),
      count: z.number().optional().nullable(),
    })
    .optional()
    .nullable(),
});

export const toPlainText = (
  text: z.infer<typeof OpenLibraryTextSchema> | null | undefined,
): string | null => {
  if (!text) {
    return null;
  }

  const value = typeof text === "string" ? text : text.value;

  return value.trim() || null;
};
