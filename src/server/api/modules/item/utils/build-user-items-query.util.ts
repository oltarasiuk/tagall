import type { Prisma } from "@prisma/client";
import type { GetUserItemsInputType } from "../types";

type FilterableInput = {
  filtering?: GetUserItemsInputType["filtering"];
  collectionsIds?: string[];
  search?: string;
};

/**
 * Builds the shared Prisma `where` clause for user item queries from the
 * common `filtering` / `search` / `collectionsIds` input shape.
 */
export function buildUserItemsWhere(
  userId: string,
  input: FilterableInput,
): Prisma.UserToItemWhereInput {
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

  const search = "search" in input ? input.search : undefined;

  return {
    userId,
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
      ...(search && {
        title: {
          contains: search,
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
  };
}

type SortingInput = GetUserItemsInputType["sorting"];

/**
 * Builds the shared `orderBy` clause. Returns undefined when no sorting requested.
 */
export function buildUserItemsOrderBy(
  sorting: SortingInput,
): Prisma.UserToItemOrderByWithRelationInput[] | undefined {
  if (!sorting) return undefined;

  switch (sorting.name) {
    case "rate":
      return [
        {
          rate: {
            sort: sorting.type,
            nulls: "last",
          },
        },
        { item: { title: "asc" } },
      ];
    case "status":
      return [{ status: sorting.type }, { item: { title: "asc" } }];
    case "date":
      return [{ updatedAt: sorting.type }, { item: { title: "asc" } }];
    case "year":
      return [
        {
          item: {
            year: {
              sort: sorting.type,
              nulls: "last",
            },
          },
        },
        { item: { title: "asc" } },
      ];
    case "title":
      return [
        { item: { title: sorting.type } },
        {
          item: {
            year: {
              sort: "desc",
              nulls: "last",
            },
          },
        },
      ];
    default:
      return undefined;
  }
}
