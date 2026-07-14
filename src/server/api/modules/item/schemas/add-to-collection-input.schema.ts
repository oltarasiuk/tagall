import { ItemStatus } from "@prisma/client";
import { z } from "zod";
import { MEDIA_KINDS, PROVIDER_NAMES } from "../../media/types/provider.type";

export const AddToCollectionInputSchema = z.object({
  provider: z.enum(PROVIDER_NAMES),
  externalId: z.string().min(1).max(255),
  mediaKind: z.enum(MEDIA_KINDS),
  collectionId: z.string().cuid(),
  selectedImageUrl: z.string().url().optional(),
  selectedImageBase64: z.string().optional(),
  rate: z.number().int().min(0).max(10),
  status: z.nativeEnum(ItemStatus),
  comment: z
    .object({
      title: z.string().min(1).max(255).nullable().optional(),
      description: z.string().min(1).max(1000).nullable().optional(),
    })
    .optional(),
  tagsIds: z.array(z.string().cuid()).optional(),
});
