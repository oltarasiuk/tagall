import { z } from "zod";
import { ArtworkSelectionSchema } from "../../artwork/schemas/artwork.schema";

export const UpdateItemImageInputSchema = z
  .object({
    id: z.string().cuid(),
    /** Preferred cover selection (same picker as add). */
    artwork: ArtworkSelectionSchema.optional(),
    /** @deprecated use `artwork` ({ mode: "manual-url" }). */
    imageUrl: z.string().url().optional(),
    /** @deprecated use `artwork` ({ mode: "upload" }). */
    imageBase64: z.string().optional(),
  })
  .refine((data) => data.artwork ?? data.imageUrl ?? data.imageBase64, {
    message: "Provide an artwork selection, imageUrl or imageBase64",
  });
