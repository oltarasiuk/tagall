import { z } from "zod";
import { MEDIA_KINDS, PROVIDER_NAMES } from "../../media/types/provider.type";

export const GetArtworkCandidatesInputSchema = z.object({
  provider: z.enum(PROVIDER_NAMES),
  externalId: z.string().min(1).max(255),
  mediaKind: z.enum(MEDIA_KINDS),
});

export type GetArtworkCandidatesInputType = z.infer<
  typeof GetArtworkCandidatesInputSchema
>;

/**
 * How the create/update flow should produce the single persisted poster. A
 * discriminated union so an invalid combination (e.g. a candidate mode without
 * a candidate id) fails validation instead of reaching the resolver.
 */
export const ArtworkSelectionSchema = z.discriminatedUnion("mode", [
  z.object({
    mode: z.literal("auto"),
    allowGeneratedFallback: z.boolean().default(true),
  }),
  z.object({
    mode: z.literal("candidate"),
    candidateId: z.string().min(1),
    allowGeneratedFallback: z.boolean().default(true),
  }),
  z.object({
    mode: z.literal("upload"),
    dataBase64: z.string().min(1),
  }),
  z.object({
    mode: z.literal("manual-url"),
    url: z.string().url(),
  }),
  z.object({
    mode: z.literal("generated"),
  }),
]);

export type ArtworkSelectionInputType = z.infer<typeof ArtworkSelectionSchema>;
