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
import {
  getVideoDetailsByImdbId,
  findByImdbId,
} from "../../parse/services/tmdb.service";
import { enrichVideoDetailsFromImdb } from "../../parse/services/imdb-crawlee.service";
import type { ImdbDetailsResultType } from "../../parse/types";
import { GetEmbedding } from "../../open-ai/services";
import { UploadImageByUrl, UploadImageByBase64, DeleteFile } from "../../files/files.service";
import { GetAnilistDetailsById } from "../../parse/services/anilist.service";
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
import { normalizeText } from "~/utils/normalize-text";
import { normalizeExternalRating } from "../utils/normalize-external-rating.util";
import { assertPublicUrl } from "../../../helpers";

const ItemResponse = new ItemResponseClass();

// #region private functions

async function UpdateEmbedding(props: {
  ctx: ContextType;
  itemId: string;
}): Promise<void> {
  const { ctx, itemId } = props;

  console.log(`[UpdateEmbedding] Starting to update embedding for item: ${itemId}`);
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
    console.error(`[UpdateEmbedding] Item not found: ${itemId}`);
    throw new Error("Item not found!");
  }

  console.log(`[UpdateEmbedding] Item found: "${item.title}" (${item.id})`);
  console.log(`[UpdateEmbedding] Transforming item details for ${itemId}`);
  const details = await ItemResponse.transformItemDetails({ ctx, item });

  console.log(`[UpdateEmbedding] Getting embedding from OpenAI for ${itemId}`);
  const embeddingStartTime = Date.now();
  const embedding = await GetEmbedding(details);
  console.log(`[UpdateEmbedding] Embedding received from OpenAI (${Date.now() - embeddingStartTime}ms)`);

  console.log(`[UpdateEmbedding] Updating embedding in database for ${itemId}`);
  await UpdateItemEmbedding({
    ctx,
    embedding,
    itemId,
  });

  const totalDuration = Date.now() - startTime;
  console.log(`[UpdateEmbedding] Successfully updated embedding for "${item.title}" (${totalDuration}ms)`);
}

async function CreateItem(props: {
  ctx: ContextType;
  type: "imdb" | "anilist";
  parsedId: string;
  collectionId: string;
}) {
  const { ctx, collectionId } = props;
  
  console.log(`[CreateItem] Starting to create item with parsedId: ${props.parsedId}, type: ${props.type}, collectionId: ${collectionId}`);
  const startTime = Date.now();
  
  // Normalize parsedId: lowercase + trim for consistency
  const parsedId = normalizeText(props.parsedId);
  console.log(`[CreateItem] Normalized parsedId: ${parsedId}`);

  // Check if item already exists before expensive operations
  console.log(`[CreateItem] Checking if item already exists: ${parsedId}`);
  const existingItem = await ctx.db.item.findFirst({
    where: {
      parsedId,
    },
  });

  if (existingItem) {
    console.log(`[CreateItem] Item already exists: ${parsedId} - ID: ${existingItem.id}, Title: "${existingItem.title}" (${Date.now() - startTime}ms)`);
    return existingItem;
  }

  // Fetch details OUTSIDE transaction to avoid timeout
  // ScrapingAnt requests can take 30+ seconds each
  console.log(`[CreateItem] Fetching details for ${parsedId} from ${props.type}`);
  let details: Record<string, unknown>;

  switch (props.type) {
    case "imdb": {
      console.log("[CreateItem] IMDB: fetching TMDB details by IMDb id", {
        parsedId,
      });
      details = await getVideoDetailsByImdbId(parsedId);
      console.log("[CreateItem] IMDB: TMDB details received, enriching from IMDB page", {
        parsedId,
        title: (details as ImdbDetailsResultType).title,
      });
      details = await enrichVideoDetailsFromImdb(
        parsedId,
        details as ImdbDetailsResultType,
      );
      break;
    }
    case "anilist":
      details = await GetAnilistDetailsById(parsedId);
      break;
    default:
      throw new Error("Invalid type");
  }
  console.log(`[CreateItem] Details fetched for ${parsedId} (${Date.now() - startTime}ms)`);

  const title = details?.title;
  if (!title || typeof title !== "string") {
    console.error(`[CreateItem] Parse error! Title not found for ${parsedId}`);
    throw new Error("Parse error! Title not found!");
  }
  console.log(`[CreateItem] Parsed title: "${title}"`);

  // Get collection info
  console.log(`[CreateItem] Fetching collection info: ${collectionId}`);
  const collection = await ctx.db.collection.findUnique({
    where: {
      id: collectionId,
    },
  });

  if (!collection) {
    console.error(`[CreateItem] Collection not found: ${collectionId}`);
    throw new Error("Collection not found!");
  }
  console.log(`[CreateItem] Collection found: ${collection.name}`);

  // Upload image OUTSIDE transaction
  console.log(`[CreateItem] Uploading image for ${parsedId}`);
  const uploadStartTime = Date.now();
  let image: string | null = null;
  try {
    image = await UploadImageByUrl(
      collection.name,
      details.image as string | null | undefined,
    );
  } catch (error) {
    console.error(
      `[CreateItem] Poster upload failed for ${parsedId}`,
      error,
    );
    throw error;
  }
  console.log(`[CreateItem] Image uploaded for ${parsedId}: ${image ?? "null"} (${Date.now() - uploadStartTime}ms)`);

  // Now start transaction for DB operations only
  console.log(`[CreateItem] Starting database transaction for ${parsedId}`);
  const transactionStartTime = Date.now();
  const transactionResult = await ctx.db.$transaction(
    async (prisma) => {
      // Double-check if item was created by another request
      const oldItem = await prisma.item.findFirst({
        where: {
          parsedId,
        },
      });

      if (oldItem) {
        console.log(`[CreateItem] Item was created by another request: ${parsedId}`);
        return oldItem;
      }

      const item = await prisma.item.create({
        data: {
          collectionId: collection.id,
          title,
          year: details.year as number,
          description: details.description as string,
          parsedId,
          image,
          externalRating:
            typeof details.rating === "number"
              ? normalizeExternalRating(details.rating)
              : null,
        },
      });
      console.log(`[CreateItem] Item created in DB: ${item.id} - "${item.title}"`);

      const keys = Object.keys(details);

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
      console.log(`[CreateItem] Found ${fieldGroups.length} field groups for ${parsedId}`);
      
      const fields: { field: string; fieldGroupId: string }[] = [];
      for (const fieldGroup of fieldGroups) {
        const value = details[fieldGroup.name as keyof typeof details]!;
        switch (typeof value) {
          case "number":
          case "string": {
            // Normalize: lowercase + trim for consistency
            const normalizedField = normalizeText(String(value));
            if (normalizedField) {
              fields.push({ field: normalizedField, fieldGroupId: fieldGroup.id });
            }
            break;
          }
          case "object": {
            if (!Array.isArray(value)) {
              continue;
            }
            for (const field of value) {
              // Normalize: lowercase + trim for consistency
              const normalizedField = normalizeText(String(field));
              if (normalizedField) {
                fields.push({
                  field: normalizedField,
                  fieldGroupId: fieldGroup.id,
                });
              }
            }
            break;
          }
        }
      }

      console.log(`[CreateItem] Upserting ${fields.length} fields for ${parsedId}`);
      const values = [...new Set(fields.map((f) => f.field))];
      const existingFields =
        values.length === 0
          ? []
          : await prisma.field.findMany({
              where: { value: { in: values } },
              select: { id: true, value: true },
            });
      const existingValues = new Set(existingFields.map((e) => e.value));
      const toCreateMap = new Map<string, string>();
      for (const { field, fieldGroupId } of fields) {
        if (!existingValues.has(field) && !toCreateMap.has(field)) {
          toCreateMap.set(field, fieldGroupId);
        }
      }
      const toCreate = [...toCreateMap.entries()].map(([value, fieldGroupId]) => ({
        value,
        fieldGroupId,
      }));
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
      console.log(`[CreateItem] All fields upserted for ${parsedId}`);

      return item;
    },
    { timeout: 180_000 }, // Increased timeout from 120s to 180s (3 minutes)
  );

  const transactionDuration = Date.now() - transactionStartTime;
  const totalDuration = Date.now() - startTime;
  console.log(`[CreateItem] Transaction completed for ${parsedId} (${transactionDuration}ms)`);
  console.log(`[CreateItem] Successfully created item: ${transactionResult.id} - "${transactionResult.title}" (Total: ${totalDuration}ms)`);

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
  const rates = input.filtering?.filter((f) => f.name === "rate") ?? [];
  const statuses = input.filtering?.filter((f) => f.name === "status") ?? [];
  const years = input.filtering?.filter((f) => f.name === "year") ?? [];
  const fields = input.filtering?.filter((f) => f.name === "field") ?? [];
  const tags = input.filtering?.filter((f) => f.name === "tag") ?? [];

  const rateFromFilter = rates.find((f) => f.type === "from");
  const rateToFilter = rates.find((f) => f.type === "to");
  const yearFromFilter = years.find((f) => f.type === "from");
  const yearToFilter = years.find((f) => f.type === "to");
  const statusIncludeFilter = statuses.filter((f) => f.type === "include");
  const statusExcludeFilter = statuses.filter((f) => f.type === "exclude");
  const includeFieldsIds = fields
    .filter((f) => f.type === "include")
    .map((f) => f.fieldId);
  const excludeFieldsIds = fields
    .filter((f) => f.type === "exclude")
    .map((f) => f.fieldId);
  const includeTagIds = tags
    .filter((f) => f.type === "include")
    .map((f) => f.tagId);
  const excludeTagIds = tags
    .filter((f) => f.type === "exclude")
    .map((f) => f.tagId);

  const userItems = await ctx.db.userToItem.findMany({
    where: {
      userId: ctx.session.user.id,
      ...((rateFromFilter || rateToFilter) && {
        rate: {
          ...(rateToFilter && {
            lte: rateToFilter.value,
          }),
          ...(rateFromFilter && {
            gte: rateFromFilter.value,
          }),
        },
      }),
      ...((statusIncludeFilter?.length || statusExcludeFilter?.length) && {
        status: {
          ...(statusIncludeFilter?.length && {
            in: statusIncludeFilter.map((filter) => filter.value),
          }),
          ...(statusExcludeFilter?.length && {
            not: {
              in: statusExcludeFilter.map((filter) => filter.value),
            },
          }),
        },
      }),

      ...(includeTagIds.length && {
        AND: includeTagIds.map((tagId) => ({
          tags: {
            some: {
              id: tagId,
            },
          },
        })),
      }),
      ...(excludeTagIds.length && {
        tags: {
          none: {
            id: {
              in: excludeTagIds,
            },
          },
        },
      }),

      item: {
        ...(input.search && {
          title: {
            contains: input.search,
            mode: "insensitive",
          },
        }),
        ...(input.collectionsIds?.length && {
          collectionId: {
            in: input.collectionsIds,
          },
        }),
        ...((yearFromFilter || yearToFilter) && {
          year: {
            ...(yearToFilter && {
              lte: yearToFilter.value,
            }),
            ...(yearFromFilter && {
              gte: yearFromFilter.value,
            }),
          },
        }),
        ...(includeFieldsIds.length && {
          AND: includeFieldsIds.map((id) => ({
            fields: {
              some: {
                id,
              },
            },
          })),
        }),
        ...(excludeFieldsIds.length && {
          fields: {
            none: {
              id: {
                in: excludeFieldsIds,
              },
            },
          },
        }),
      },
    },

    ...(input.sorting && {
      ...(input.sorting.name === "rate" && {
        orderBy: [
          {
            rate: {
              sort: input.sorting.type,
              nulls: "last",
            },
          },
          { item: { title: "asc" } },
        ],
      }),
      ...(input.sorting.name === "status" && {
        orderBy: [{ status: input.sorting.type }, { item: { title: "asc" } }],
      }),
      ...(input.sorting.name === "date" && {
        orderBy: [
          { updatedAt: input.sorting.type },
          { item: { title: "asc" } },
        ],
      }),
      ...(input.sorting.name === "year" && {
        orderBy: [
          {
            item: {
              year: {
                sort: input.sorting.type,
                nulls: "last",
              },
            },
          },
          { item: { title: "asc" } },
        ],
      }),
      ...(input.sorting.name === "title" && {
        orderBy: [
          { item: { title: input.sorting.type } },
          {
            item: {
              year: {
                sort: "desc",
                nulls: "last",
              },
            },
          },
        ],
      }),
    }),

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

  const rates = input.filtering?.filter((f) => f.name === "rate") ?? [];
  const statuses = input.filtering?.filter((f) => f.name === "status") ?? [];
  const years = input.filtering?.filter((f) => f.name === "year") ?? [];
  const fields = input.filtering?.filter((f) => f.name === "field") ?? [];
  const tags = input.filtering?.filter((f) => f.name === "tag") ?? [];

  const rateFromFilter = rates.find((f) => f.type === "from");
  const rateToFilter = rates.find((f) => f.type === "to");
  const yearFromFilter = years.find((f) => f.type === "from");
  const yearToFilter = years.find((f) => f.type === "to");
  const statusIncludeFilter = statuses.filter((f) => f.type === "include");
  const statusExcludeFilter = statuses.filter((f) => f.type === "exclude");
  const includeFieldsIds = fields
    .filter((f) => f.type === "include")
    .map((f) => f.fieldId);
  const excludeFieldsIds = fields
    .filter((f) => f.type === "exclude")
    .map((f) => f.fieldId);
  const includeTagIds = tags
    .filter((f) => f.type === "include")
    .map((f) => f.tagId);
  const excludeTagIds = tags
    .filter((f) => f.type === "exclude")
    .map((f) => f.tagId);

  const userItems = await ctx.db.userToItem.findMany({
    where: {
      userId: ctx.session.user.id,
      ...((rateFromFilter || rateToFilter) && {
        rate: {
          ...(rateToFilter && {
            lte: rateToFilter.value,
          }),
          ...(rateFromFilter && {
            gte: rateFromFilter.value,
          }),
        },
      }),
      ...((statusIncludeFilter?.length || statusExcludeFilter?.length) && {
        status: {
          ...(statusIncludeFilter?.length && {
            in: statusIncludeFilter.map((filter) => filter.value),
          }),
          ...(statusExcludeFilter?.length && {
            not: {
              in: statusExcludeFilter.map((filter) => filter.value),
            },
          }),
        },
      }),

      ...(includeTagIds.length && {
        AND: includeTagIds.map((tagId) => ({
          tags: {
            some: {
              id: tagId,
            },
          },
        })),
      }),
      ...(excludeTagIds.length && {
        tags: {
          none: {
            id: {
              in: excludeTagIds,
            },
          },
        },
      }),

      item: {
        ...(input.search && {
          title: {
            contains: input.search,
            mode: "insensitive",
          },
        }),
        ...(input.collectionsIds?.length && {
          collectionId: {
            in: input.collectionsIds,
          },
        }),
        ...((yearFromFilter || yearToFilter) && {
          year: {
            ...(yearToFilter && {
              lte: yearToFilter.value,
            }),
            ...(yearFromFilter && {
              gte: yearFromFilter.value,
            }),
          },
        }),
        ...(includeFieldsIds.length && {
          AND: includeFieldsIds.map((id) => ({
            fields: {
              some: {
                id,
              },
            },
          })),
        }),
        ...(excludeFieldsIds.length && {
          fields: {
            none: {
              id: {
                in: excludeFieldsIds,
              },
            },
          },
        }),
      },
    },

    ...(input.sorting && {
      ...(input.sorting.name === "rate" && {
        orderBy: [
          {
            rate: {
              sort: input.sorting.type,
              nulls: "last",
            },
          },
          { item: { title: "asc" } },
        ],
      }),
      ...(input.sorting.name === "status" && {
        orderBy: [{ status: input.sorting.type }, { item: { title: "asc" } }],
      }),
      ...(input.sorting.name === "date" && {
        orderBy: [
          { updatedAt: input.sorting.type },
          { item: { title: "asc" } },
        ],
      }),
      ...(input.sorting.name === "year" && {
        orderBy: [
          {
            item: {
              year: {
                sort: input.sorting.type,
                nulls: "last",
              },
            },
          },
          { item: { title: "asc" } },
        ],
      }),
      ...(input.sorting.name === "title" && {
        orderBy: [
          { item: { title: input.sorting.type } },
          {
            item: {
              year: {
                sort: "desc",
                nulls: "last",
              },
            },
          },
        ],
      }),
    }),

    include: {
      tags: true,
      item: {
        include: {
          collection: true,
        },
      },
    },
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

  console.log(`[AddToCollection] Starting to add item to collection`);
  console.log(`[AddToCollection] User: ${ctx.session.user.id}, ParsedId: ${input.parsedId}, CollectionId: ${input.collectionId}`);
  const startTime = Date.now();

  console.log(`[AddToCollection] Fetching collection info: ${input.collectionId}`);
  const collection = await ctx.db.collection.findUnique({
    where: { id: input.collectionId },
  });

  if (!collection) {
    console.error(`[AddToCollection] Collection not found: ${input.collectionId}`);
    throw new Error("Collection not found");
  }
  console.log(`[AddToCollection] Collection found: ${collection.name}`);

  let item;
  try {
    switch (collection.name) {
      case "Serie":
      case "Film": {
        const found = await findByImdbId(input.parsedId);
        const mediaType = found?.mediaType ?? "movie";
        const targetCollectionName = mediaType === "movie" ? "Film" : "Serie";
        const targetCollection = await ctx.db.collection.findFirst({
          where: { name: targetCollectionName },
        });
        if (!targetCollection) {
          throw new Error(`Collection "${targetCollectionName}" not found`);
        }
        console.log(`[AddToCollection] Creating video item (${mediaType}) for ${targetCollectionName}`);
        item = await CreateItem({
          ctx,
          type: "imdb",
          parsedId: input.parsedId,
          collectionId: targetCollection.id,
        });
        break;
      }
      case "Manga":
        console.log(`[AddToCollection] Creating Anilist item for Manga`);
        item = await CreateItem({
          ctx,
          type: "anilist",
          parsedId: input.parsedId,
          collectionId: collection.id,
        });
        break;
      default:
        console.error(`[AddToCollection] Invalid collection name: ${collection.name}`);
        throw new Error("Invalid collection name");
    }
    console.log(`[AddToCollection] Item created successfully: ${item.id} - "${item.title}" (${Date.now() - startTime}ms)`);
  } catch (error) {
    const duration = Date.now() - startTime;
    console.error(`[AddToCollection] Error creating item after ${duration}ms:`, error);
    throw new Error(
      `Failed to create item: ${error instanceof Error ? error.message : "Unknown error"}`,
    );
  }

  if (!item) {
    console.error(`[AddToCollection] Item not found after creation`);
    throw new Error("Something went wrong! Item not found!");
  }

  console.log(`[AddToCollection] Updating embedding for item: ${item.id}`);
  await UpdateEmbedding({ ctx, itemId: item.id });

  console.log(`[AddToCollection] Creating user-to-item relationship`);
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
  console.log(`[AddToCollection] User-to-item relationship created: ${userToItem.id}`);

  if (input.comment) {
    console.log(`[AddToCollection] Creating comment for item: ${item.id}`);
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
    console.log(`[AddToCollection] Comment created`);
  }

  const totalDuration = Date.now() - startTime;
  console.log(`[AddToCollection] Successfully added "${item.title}" to collection "${collection.name}" (Total: ${totalDuration}ms)`);

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

  const rates = input.filtering?.filter((f) => f.name === "rate") ?? [];
  const statuses = input.filtering?.filter((f) => f.name === "status") ?? [];
  const years = input.filtering?.filter((f) => f.name === "year") ?? [];
  const fields = input.filtering?.filter((f) => f.name === "field") ?? [];
  const tags = input.filtering?.filter((f) => f.name === "tag") ?? [];

  const rateFromFilter = rates.find((f) => f.type === "from");
  const rateToFilter = rates.find((f) => f.type === "to");
  const yearFromFilter = years.find((f) => f.type === "from");
  const yearToFilter = years.find((f) => f.type === "to");
  const statusIncludeFilter = statuses.filter((f) => f.type === "include");
  const statusExcludeFilter = statuses.filter((f) => f.type === "exclude");
  const includeFieldsIds = fields
    .filter((f) => f.type === "include")
    .map((f) => f.fieldId);
  const excludeFieldsIds = fields
    .filter((f) => f.type === "exclude")
    .map((f) => f.fieldId);
  const includeTagIds = tags
    .filter((f) => f.type === "include")
    .map((f) => f.tagId);
  const excludeTagIds = tags
    .filter((f) => f.type === "exclude")
    .map((f) => f.tagId);

  const radndomUserItems = await ctx.db.userToItem.findManyRandom(limit, {
    where: {
      userId: ctx.session.user.id,
      ...((rateFromFilter || rateToFilter) && {
        rate: {
          ...(rateToFilter && {
            lte: rateToFilter.value,
          }),
          ...(rateFromFilter && {
            gte: rateFromFilter.value,
          }),
        },
      }),
      ...((statusIncludeFilter?.length || statusExcludeFilter?.length) && {
        status: {
          ...(statusIncludeFilter?.length && {
            in: statusIncludeFilter.map((filter) => filter.value),
          }),
          ...(statusExcludeFilter?.length && {
            not: {
              in: statusExcludeFilter.map((filter) => filter.value),
            },
          }),
        },
      }),

      ...(includeTagIds.length && {
        AND: includeTagIds.map((tagId) => ({
          tags: {
            some: {
              id: tagId,
            },
          },
        })),
      }),
      ...(excludeTagIds.length && {
        tags: {
          none: {
            id: {
              in: excludeTagIds,
            },
          },
        },
      }),

      item: {
        ...(input.collectionsIds?.length && {
          collectionId: {
            in: input.collectionsIds,
          },
        }),
        ...((yearFromFilter || yearToFilter) && {
          year: {
            ...(yearToFilter && {
              lte: yearToFilter.value,
            }),
            ...(yearFromFilter && {
              gte: yearFromFilter.value,
            }),
          },
        }),
        ...(includeFieldsIds.length && {
          AND: includeFieldsIds.map((id) => ({
            fields: {
              some: {
                id,
              },
            },
          })),
        }),
        ...(excludeFieldsIds.length && {
          fields: {
            none: {
              id: {
                in: excludeFieldsIds,
              },
            },
          },
        }),
      },
    },
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
  console.log(`Found ${items.length} items`);
  for (let i = 0; i < items.length; i++) {
    const item = items[i];
    if (item) {
      console.log(`==============START ${i}=======================`);
      console.log(`${i}) Updating ${item.title}`);
      try {
        await UpdateEmbedding({ ctx, itemId: item.id });
      } catch (error) {
        console.log(`Error updating ${item.title}`);
        console.log(error);
      }
      console.log(`=================END ${i}====================`);
    }
  }

  console.log("Finished");
}

// #endregion public functions
