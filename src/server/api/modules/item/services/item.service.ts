import type { ContextType } from "../../../../types";
import type {
  UpdateItemInputType,
  UpdateItemImageInputType,
  AddToCollectionInputType,
  GetUserItemInputType,
  GetUserItemsInputType,
  GetAllUserItemsInputType,
  GetYearsRangeInputType,
  DeleteFromCollectionInputType,
  ItemType,
  TierItemType,
  GetRandomUserItemsInputType,
  GetUserItemsStatsInputType,
  ItemsStatsType,
  GetNearestItemsInputType,
} from "../types";
import { GetEmbedding } from "../../open-ai/services";
import {
  UploadImageByUrl,
  UploadImageByBase64,
  DeleteFile,
  DownloadAndUploadProviderImage,
  DeleteUploadedImage,
} from "../../files/files.service";
import { selectImageCandidates } from "../../media/utils/select-image-candidates.util";
import {
  getCollectionSlugForMediaKind,
  getMediaKindForCollectionSlug,
} from "../../media/constants/media-kind.const";
import { MediaError } from "../../media/errors/media.error";
import { providerRegistry } from "../../media/providers";
import { getMediaDetails } from "../../media/services/media-details.service";
import type {
  NormalizedItemDetailsType,
  ProviderNameType,
} from "../../media/types";
import { buildCanonicalKey } from "../../media/utils/canonical-key.util";
import { toProviderEnum } from "../../media/types/provider.type";
import {
  UpdateItemEmbedding,
  GetItemEmbedding,
  GetNearestItemsIds,
} from "./item-embedding.service";
import type { SearchItemByTextInputSchema } from "../types/search-item-by-text-input.type";
import { ItemResponseClass } from "../item-response.class";
import {
  getUserItemsDateStats,
  getUserItemsRateStats,
  getUserItemsStatusStats,
} from "./item-stats.service";
import { logger } from "~/lib/logger";
import { MAX_ALL_USER_ITEMS } from "~/constants/limits.const";
import { normalizeExternalRating } from "../utils/normalize-external-rating.util";
import { assertPublicUrl } from "../../../helpers";
import {
  buildUserItemsWhere,
  buildUserItemsOrderBy,
} from "../utils/build-user-items-query.util";
import {
  buildFieldCandidates,
  getFieldKey,
} from "../utils/build-field-candidates.util";

const ItemResponse = new ItemResponseClass();

// #region private functions

async function UpdateEmbedding(props: {
  ctx: ContextType;
  itemId: string;
}): Promise<void> {
  const { ctx, itemId } = props;

  logger.debug(`[UpdateEmbedding] Starting to update embedding for item: ${itemId}`);
  const startTime = Date.now();

  const item = await ctx.db.item.findUnique({
    where: {
      id: itemId,
    },
    include: {
      fields: true,
      collection: true,
    },
  });

  if (!item) {
    logger.error(`[UpdateEmbedding] Item not found: ${itemId}`);
    throw new Error("Item not found!");
  }

  logger.debug(`[UpdateEmbedding] Item found: "${item.title}" (${item.id})`);
  logger.debug(`[UpdateEmbedding] Transforming item details for ${itemId}`);
  const details = await ItemResponse.transformItemDetails({ ctx, item });

  logger.debug(`[UpdateEmbedding] Getting embedding from OpenAI for ${itemId}`);
  const embeddingStartTime = Date.now();
  const embedding = await GetEmbedding(details);
  logger.debug(`[UpdateEmbedding] Embedding received from OpenAI (${Date.now() - embeddingStartTime}ms)`);

  logger.debug(`[UpdateEmbedding] Updating embedding in database for ${itemId}`);
  await UpdateItemEmbedding({
    ctx,
    embedding,
    itemId,
  });

  const totalDuration = Date.now() - startTime;
  logger.debug(`[UpdateEmbedding] Successfully updated embedding for "${item.title}" (${totalDuration}ms)`);
}

async function CreateItem(props: {
  ctx: ContextType;
  provider: ProviderNameType;
  externalId: string;
  details: NormalizedItemDetailsType;
  collection: { id: string; name: string; slug: string };
}) {
  const { ctx, provider, externalId, details, collection } = props;

  const startTime = Date.now();

  const providerEnum = toProviderEnum(provider);
  if (!providerEnum) {
    throw new MediaError("PROVIDER_DISABLED", `Unknown provider "${provider}"`);
  }

  // Exact, case-preserving key. External ids never go through normalizeText().
  const parsedId = buildCanonicalKey(providerEnum, externalId);
  logger.debug(`[CreateItem] Canonical key: ${parsedId}`);

  const identifiers = details.identifiers.length
    ? details.identifiers
    : [{ provider, externalId }];

  // An item may already be known under any of its provider identifiers, not
  // just the one the user searched from.
  const existingItem = await ctx.db.item.findFirst({
    where: {
      OR: [
        { parsedId },
        {
          externalIdentifiers: {
            some: {
              OR: identifiers.flatMap((identifier) => {
                const identifierEnum = toProviderEnum(identifier.provider);
                return identifierEnum
                  ? [
                      {
                        provider: identifierEnum,
                        externalId: identifier.externalId,
                      },
                    ]
                  : [];
              }),
            },
          },
        },
      ],
    },
  });

  if (existingItem) {
    logger.debug(`[CreateItem] Item already exists: ${parsedId} - ID: ${existingItem.id} (${Date.now() - startTime}ms)`);
    return existingItem;
  }

  const { title } = details;

  // Poster download and upload stay outside the transaction: no network call
  // may hold a DB transaction open.
  logger.debug(`[CreateItem] Downloading poster for ${parsedId}`);
  const uploadStartTime = Date.now();
  const candidates = selectImageCandidates(
    details.imageCandidates,
    details.mediaKind,
  );

  let image: string | null = null;
  let lastImageError: unknown = null;

  for (const candidate of candidates) {
    try {
      image = await DownloadAndUploadProviderImage({
        folder: collection.name,
        canonicalKey: parsedId,
        mediaKind: details.mediaKind,
        candidate,
      });
      break;
    } catch (error) {
      lastImageError = error;
      logger.error(
        `[CreateItem] Poster candidate from ${candidate.source} rejected for ${parsedId}`,
        error,
      );
    }
  }

  if (!image) {
    // Better no item than an item hotlinking a provider or showing no cover:
    // the UI turns this into a manual cover prompt.
    throw new MediaError(
      "POSTER_REQUIRED",
      `No usable cover for "${title}". Provide one manually.`,
      { cause: lastImageError },
    );
  }
  logger.debug(`[CreateItem] Poster stored for ${parsedId}: ${image} (${Date.now() - uploadStartTime}ms)`);

  // Now start transaction for DB operations only
  logger.debug(`[CreateItem] Starting database transaction for ${parsedId}`);
  const transactionStartTime = Date.now();
  const runTransaction = () => ctx.db.$transaction(
    async (prisma) => {
      let item;
      try {
        item = await prisma.item.create({
          data: {
            collectionId: collection.id,
            title,
            originalTitle: details.originalTitle,
            originalLanguage: details.originalLanguage,
            sourceUrl: details.sourceUrl,
            year: details.year,
            description: details.description,
            parsedId,
            image,
            externalRating:
              details.rating != null
                ? normalizeExternalRating(details.rating.normalized10)
                : null,
            externalIdentifiers: {
              create: identifiers.flatMap((identifier) => {
                const identifierEnum = toProviderEnum(identifier.provider);
                return identifierEnum
                  ? [
                      {
                        provider: identifierEnum,
                        externalId: identifier.externalId,
                        url: identifier.url ?? null,
                        isPrimary: identifier.provider === provider,
                      },
                    ]
                  : [];
              }),
            },
          },
        });
      } catch (error) {
        // Unique violation on parsedId: another request created the item concurrently
        if (
          error &&
          typeof error === "object" &&
          "code" in error &&
          (error as { code: string }).code === "P2002"
        ) {
          const oldItem = await prisma.item.findUnique({ where: { parsedId } });
          if (oldItem) {
            logger.debug(
              `[CreateItem] Item was created by another request: ${parsedId}`,
            );
            return oldItem;
          }
        }
        throw error;
      }
      logger.debug(`[CreateItem] Item created in DB: ${item.id} - "${item.title}"`);

      const keys = Object.keys(details.fields);

      const fieldGroups =
        keys.length === 0
          ? []
          : await prisma.fieldGroup.findMany({
              where: {
                name: { in: keys },
                collections: { some: { id: collection.id } },
              },
              select: { id: true, name: true },
            });
      logger.debug(`[CreateItem] Found ${fieldGroups.length} field groups for ${parsedId}`);

      const candidates = buildFieldCandidates(details.fields, fieldGroups);

      logger.debug(`[CreateItem] Upserting ${candidates.length} fields for ${parsedId}`);
      // A field is identified by (fieldGroupId, value): looking it up by value
      // alone would reuse a genre row for a keyword of the same name.
      const existingFields =
        candidates.length === 0
          ? []
          : await prisma.field.findMany({
              where: {
                OR: candidates.map(({ value, fieldGroupId }) => ({
                  value,
                  fieldGroupId,
                })),
              },
              select: { id: true, value: true, fieldGroupId: true },
            });
      const existingKeys = new Set(existingFields.map(getFieldKey));
      const toCreate = candidates.filter(
        (candidate) => !existingKeys.has(getFieldKey(candidate)),
      );
      const createdFields =
        toCreate.length > 0
          ? await prisma.field.createManyAndReturn({
              data: toCreate,
            })
          : [];
      const allFieldIds = [
        ...existingFields.map((f) => f.id),
        ...createdFields.map((f) => f.id),
      ];
      if (allFieldIds.length > 0) {
        await prisma.item.update({
          where: { id: item.id },
          data: {
            fields: {
              connect: allFieldIds.map((id) => ({ id })),
            },
          },
        });
      }
      logger.debug(`[CreateItem] All fields upserted for ${parsedId}`);

      return item;
    },
    { timeout: 15_000 }, // DB-only work inside the transaction; external calls happen before it
  );

  let transactionResult;
  try {
    transactionResult = await runTransaction();
  } catch (error) {
    // The poster is already in Cloudinary but no item points at it.
    await DeleteUploadedImage(collection.name, image);
    throw error;
  }

  const transactionDuration = Date.now() - transactionStartTime;
  const totalDuration = Date.now() - startTime;
  logger.debug(`[CreateItem] Transaction completed for ${parsedId} (${transactionDuration}ms)`);
  logger.debug(`[CreateItem] Successfully created item: ${transactionResult.id} - "${transactionResult.title}" (Total: ${totalDuration}ms)`);

  return transactionResult;
}
// #endregion private functions

// #region public functions

export async function GetUserItems(props: {
  ctx: ContextType;
  input: GetUserItemsInputType;
}): Promise<ItemType[]> {
  const { ctx, input } = props;

  const limit = input.limit ?? 20;
  const page = input.page ?? 1;

  const userItems = await ctx.db.userToItem.findMany({
    where: buildUserItemsWhere(ctx.session.user.id, input),
    orderBy: buildUserItemsOrderBy(input.sorting),
    include: {
      tags: true,
      item: {
        include: {
          collection: true,
        },
      },
    },
    take: limit,
    skip: (page - 1) * limit,
  });

  return ItemResponse.transformUserItems(userItems);
}

export async function GetAllUserItems(props: {
  ctx: ContextType;
  input: GetAllUserItemsInputType;
}): Promise<TierItemType[]> {
  const { ctx, input } = props;

  const userItems = await ctx.db.userToItem.findMany({
    where: buildUserItemsWhere(ctx.session.user.id, input),
    orderBy: buildUserItemsOrderBy(input.sorting),
    include: {
      tags: true,
      item: {
        include: {
          collection: true,
        },
      },
    },
    take: MAX_ALL_USER_ITEMS,
  });

  return ItemResponse.transformTierItems(userItems);
}

export async function GetUserItemsStats(props: {
  ctx: ContextType;
  input: GetUserItemsStatsInputType;
}): Promise<ItemsStatsType> {
  const { ctx, input } = props;

  const [date, rate, status, all] = await Promise.all([
    getUserItemsDateStats({ ctx, collectionsIds: input }),
    getUserItemsRateStats({ ctx, collectionsIds: input }),
    getUserItemsStatusStats({ ctx, collectionsIds: input }),
    ctx.db.userToItem.count({
      where: {
        userId: ctx.session.user.id,
        ...(input.length && {
          item: {
            collectionId: {
              in: input,
            },
          },
        }),
      },
    }),
  ]);

  return {
    date,
    rate,
    status,
    all,
  };
}

export async function GetUserItem(props: {
  ctx: ContextType;
  input: GetUserItemInputType;
}): Promise<ItemType | null> {
  const { ctx, input } = props;

  const userItem = await ctx.db.userToItem.findUnique({
    where: {
      userId_itemId: {
        userId: ctx.session.user.id,
        itemId: input,
      },
    },
    include: {
      item: {
        include: {
          collection: true,
          fields: true,
        },
      },
      tags: true,
    },
  });

  if (!userItem) {
    return null;
  }

  return ItemResponse.transformUserItem(userItem);
}

export async function GetNearestItems(props: {
  ctx: ContextType;
  input: GetNearestItemsInputType;
}): Promise<ItemType[]> {
  const { ctx, input } = props;

  const itemEmbedding = await GetItemEmbedding({
    ctx,
    itemId: input.itemId,
  });

  const nearestItemsIds = await GetNearestItemsIds({
    ctx,
    embedding: itemEmbedding,
    limit: input.limit,
  });

  const nearestUserItems = await ctx.db.userToItem.findMany({
    where: {
      userId: ctx.session.user.id,
      item: {
        id: {
          in: nearestItemsIds,
        },
      },
    },
    include: {
      tags: true,
      item: {
        include: {
          collection: true,
        },
      },
    },
  });

  return ItemResponse.transformUserItems(nearestUserItems);
}

export async function GetYearsRange(props: {
  ctx: ContextType;
  input: GetYearsRangeInputType;
}) {
  const { ctx, input } = props;

  const yearRange = await ctx.db.item.aggregate({
    _min: {
      year: true,
    },
    _max: {
      year: true,
    },
    where: {
      year: {
        not: null,
      },
      userToItems: {
        some: {
          userId: ctx.session.user.id,
        },
      },
      ...(input.length && {
        collectionId: {
          in: input,
        },
      }),
    },
  });

  return {
    minYear: yearRange._min.year,
    maxYear: yearRange._max.year,
  };
}

export async function AddToCollection(props: {
  ctx: ContextType;
  input: AddToCollectionInputType;
}) {
  const { ctx, input } = props;

  logger.debug(`[AddToCollection] Starting to add item to collection`);
  logger.debug(`[AddToCollection] User: ${ctx.session.user.id}, ParsedId: ${input.parsedId}, CollectionId: ${input.collectionId}`);
  const startTime = Date.now();

  logger.debug(`[AddToCollection] Fetching collection info: ${input.collectionId}`);
  const collection = await ctx.db.collection.findUnique({
    where: { id: input.collectionId },
  });

  if (!collection) {
    logger.error(`[AddToCollection] Collection not found: ${input.collectionId}`);
    throw new Error("Collection not found");
  }
  logger.debug(`[AddToCollection] Collection found: ${collection.slug}`);

  const mediaKind = getMediaKindForCollectionSlug(collection.slug);

  if (!mediaKind) {
    throw new MediaError(
      "PROVIDER_DISABLED",
      `No provider for collection "${collection.slug}"`,
    );
  }

  const [adapter] = providerRegistry.getEnabledForKind(mediaKind);

  if (!adapter) {
    throw new MediaError(
      "PROVIDER_DISABLED",
      `No enabled provider for "${mediaKind}"`,
    );
  }

  let item;
  try {
    // Details are re-fetched server-side: the client only names the provider
    // and the external id.
    const details = await getMediaDetails({
      provider: adapter.name,
      externalId: input.parsedId,
    });

    // The provider decides what the item actually is — a TMDB search from the
    // Film tab may well return a series.
    const targetSlug = getCollectionSlugForMediaKind(details.mediaKind);
    const targetCollection =
      targetSlug === collection.slug
        ? collection
        : await ctx.db.collection.findUnique({ where: { slug: targetSlug } });

    if (!targetCollection) {
      throw new MediaError(
        "MEDIA_KIND_MISMATCH",
        `Collection "${targetSlug}" not found for ${details.mediaKind}`,
      );
    }

    logger.debug(`[AddToCollection] Creating ${details.mediaKind} item in ${targetSlug}`);
    item = await CreateItem({
      ctx,
      provider: adapter.name,
      externalId: input.parsedId,
      details,
      collection: targetCollection,
    });
    logger.debug(`[AddToCollection] Item created successfully: ${item.id} - "${item.title}" (${Date.now() - startTime}ms)`);
  } catch (error) {
    const duration = Date.now() - startTime;
    logger.error(`[AddToCollection] Error creating item after ${duration}ms:`, error);
    throw new Error(
      `Failed to create item: ${error instanceof Error ? error.message : "Unknown error"}`,
    );
  }

  if (!item) {
    logger.error(`[AddToCollection] Item not found after creation`);
    throw new Error("Something went wrong! Item not found!");
  }

  logger.debug(`[AddToCollection] Creating user-to-item relationship`);
  const userToItem = await ctx.db.userToItem.create({
    data: {
      userId: ctx.session.user.id,
      itemId: item.id,
      rate: input.rate ?? null,
      status: input.status,
      ...(input.tagsIds?.length && {
        tags: {
          connect: input.tagsIds.map((tag) => ({ id: tag })),
        },
      }),
    },
  });
  logger.debug(`[AddToCollection] User-to-item relationship created: ${userToItem.id}`);

  // Fire-and-forget: embedding is only needed for similarity search later,
  // do not block the user response on the OpenAI call.
  logger.debug(`[AddToCollection] Scheduling embedding update for item: ${item.id}`);
  void UpdateEmbedding({ ctx, itemId: item.id }).catch((error) => {
    logger.error(
      `[AddToCollection] Background embedding update failed for ${item.id}:`,
      error,
    );
  });

  if (input.comment) {
    logger.debug(`[AddToCollection] Creating comment for item: ${item.id}`);
    await ctx.db.itemComment.create({
      data: {
        title: input.comment.title,
        description: input.comment.description
          ? input.comment.description
          : null,
        rate: input.rate,
        status: input.status,
        userToItemId: userToItem.id,
      },
    });
    logger.debug(`[AddToCollection] Comment created`);
  }

  const totalDuration = Date.now() - startTime;
  logger.debug(`[AddToCollection] Successfully added "${item.title}" to collection "${collection.name}" (Total: ${totalDuration}ms)`);

  return "Item added successfully!";
}

export async function UpdateItem(props: {
  ctx: ContextType;
  input: UpdateItemInputType;
}) {
  const { ctx, input } = props;

  const item = await ctx.db.userToItem.findUnique({
    where: {
      userId_itemId: {
        userId: ctx.session.user.id,
        itemId: input.id,
      },
    },
  });

  if (!item) {
    throw new Error("Item not found!");
  }

  await ctx.db.userToItem.update({
    where: {
      userId_itemId: {
        userId: ctx.session.user.id,
        itemId: input.id,
      },
    },
    data: {
      rate: input.rate,
      status: input.status,
      ...(input.tagsIds && {
        tags: { set: input.tagsIds.map((tag) => ({ id: tag })) },
      }),
    },
  });

  return "Item updated successfully!";
}

export async function UpdateItemImage(props: {
  ctx: ContextType;
  input: UpdateItemImageInputType;
}): Promise<string> {
  const { ctx, input } = props;

  // Check if user owns this item
  const userItem = await ctx.db.userToItem.findUnique({
    where: {
      userId_itemId: {
        userId: ctx.session.user.id,
        itemId: input.id,
      },
    },
    include: {
      item: {
        include: {
          collection: true,
        },
      },
    },
  });

  if (!userItem) {
    throw new Error("Item not found!");
  }

  const { item } = userItem;
  const oldImage = item.image;

  // Upload new image
  let newImageId: string | null = null;

  if (input.imageUrl) {
    await assertPublicUrl(input.imageUrl);
    newImageId = await UploadImageByUrl(item.collection.name, input.imageUrl);
  } else if (input.imageBase64) {
    newImageId = await UploadImageByBase64(
      item.collection.name,
      input.imageBase64,
    );
  }

  if (!newImageId) {
    throw new Error("Failed to upload image");
  }

  // Delete old image from Cloudinary if exists
  if (oldImage) {
    await DeleteFile(item.collection.name, oldImage);
  }

  // Update item image in database
  // NOTE: Item is shared across users (deduplicated by parsedId).
  // Updating the image here changes it for every user who has this item.
  await ctx.db.item.update({
    where: {
      id: input.id,
    },
    data: {
      image: newImageId,
    },
  });

  return "Item image updated successfully!";
}

export async function DeleteFromCollection(props: {
  ctx: ContextType;
  input: DeleteFromCollectionInputType;
}) {
  const { ctx, input } = props;

  const item = await ctx.db.userToItem.findUnique({
    where: {
      userId_itemId: {
        userId: ctx.session.user.id,
        itemId: input,
      },
    },
  });

  if (!item) {
    throw new Error("Item not found!");
  }

  await ctx.db.userToItem.delete({
    where: {
      userId_itemId: {
        userId: ctx.session.user.id,
        itemId: input,
      },
    },
  });

  return "Item deleted successfully!";
}

export async function SearchItemByText(props: {
  ctx: ContextType;
  input: SearchItemByTextInputSchema;
}) {
  const { ctx, input } = props;

  const embedding = await GetEmbedding(input);

  const nearestItemsIds = await GetNearestItemsIds({
    ctx,
    embedding,
    limit: 12,
  });

  const nearestUserItems = await ctx.db.userToItem.findMany({
    where: {
      userId: ctx.session.user.id,
      item: {
        id: {
          in: nearestItemsIds,
        },
      },
    },
    include: {
      tags: true,
      item: {
        include: {
          collection: true,
        },
      },
    },
  });

  return ItemResponse.transformUserItems(nearestUserItems);
}

export async function GetRandomUserItems(props: {
  ctx: ContextType;
  input: GetRandomUserItemsInputType;
}): Promise<ItemType[]> {
  const { ctx, input } = props;

  const limit = input.limit ?? 12;

  const radndomUserItems = await ctx.db.userToItem.findManyRandom(limit, {
    where: buildUserItemsWhere(ctx.session.user.id, input),
    select: {
      id: true,
    },
  });

  const userItems = await ctx.db.userToItem.findMany({
    where: {
      id: {
        in: radndomUserItems.map((item) => item.id),
      },
    },
    include: {
      tags: true,
      item: {
        include: {
          collection: true,
        },
      },
    },
  });

  return ItemResponse.transformUserItems(userItems);
}

export async function UpdateAllEmbeddings(props: { ctx: ContextType }) {
  const { ctx } = props;

  const items = await ctx.db.item.findMany();
  logger.debug(`Found ${items.length} items`);
  for (let i = 0; i < items.length; i++) {
    const item = items[i];
    if (item) {
      logger.debug(`==============START ${i}=======================`);
      logger.debug(`${i}) Updating ${item.title}`);
      try {
        await UpdateEmbedding({ ctx, itemId: item.id });
      } catch (error) {
        logger.debug(`Error updating ${item.title}`);
        logger.debug(error);
      }
      logger.debug(`=================END ${i}====================`);
    }
  }

  logger.debug("Finished");
}

// #endregion public functions
