import {
  createTRPCRouter,
  protectedProcedure,
  publicProcedure,
} from "~/server/api/trpc";
import {
  AddToCollectionInputSchema,
  DeleteFromCollectionInputSchema,
  GetNearestItemsInputSchema,
  GetRandomUserItemsInputSchema,
  GetUserItemInputSchema,
  GetUserItemsInputSchema,
  GetAllUserItemsInputSchema,
  GetUserItemsStatsInputSchema,
  GetYearsRangeInputSchema,
  SearchItemByTextInputSchema,
  UpdateItemInputSchema,
  UpdateItemImageInputSchema,
} from "./schemas";
import {
  AddToCollection,
  DeleteFromCollection,
  GetNearestItems,
  GetRandomUserItems,
  GetUserItem,
  GetUserItems,
  GetAllUserItems,
  GetUserItemsStats,
  GetYearsRange,
  SearchItemByText,
  UpdateItem,
  UpdateItemImage,
} from "./services";
import { CACHE_TTL_SECONDS, getOrSetCache } from "../../../../lib/redis";
import { getFirstAllowedUser } from "../../helpers";
import { invalidateItemCaches } from "./utils/cache-invalidation.util";

export const ItemRouter = createTRPCRouter({
  getUserItems: protectedProcedure
    .input(GetUserItemsInputSchema)
    .query(async (props) => {
      const { ctx, input } = props;

      const response = await getOrSetCache(
        () => GetUserItems(props),
        "item",
        "getUserItems",
        {
          userId: ctx.session.user.id,
          input,
        },
      );

      return response;
    }),

  getAllUserItems: protectedProcedure
    .input(GetAllUserItemsInputSchema)
    .query(async (props) => {
      const { ctx, input } = props;

      const response = await getOrSetCache(
        () => GetAllUserItems(props),
        "item",
        "getAllUserItems",
        {
          userId: ctx.session.user.id,
          input,
        },
      );

      return response;
    }),

  getRandomUserItems: protectedProcedure
    .input(GetRandomUserItemsInputSchema)
    .query(GetRandomUserItems),

  getUserItemsStats: protectedProcedure
    .input(GetUserItemsStatsInputSchema)
    .query(async (props) => {
      const { ctx, input } = props;
      const response = await getOrSetCache(
        () => GetUserItemsStats(props),
        "item",
        "getUserItemsStats",
        {
          userId: ctx.session.user.id,
          input,
        },
      );
      return response;
    }),

  getUserItem: protectedProcedure
    .input(GetUserItemInputSchema)
    .query(async (props) => {
      const { ctx, input } = props;
      const response = await getOrSetCache(
        () => GetUserItem(props),
        "item",
        "getUserItem",
        {
          userId: ctx.session.user.id,
          input,
        },
      );
      return response;
    }),

  getNearestItems: protectedProcedure
    .input(GetNearestItemsInputSchema)
    .query(async (props) => {
      const { input } = props;
      const response = await getOrSetCache(
        () => GetNearestItems(props),
        "item",
        "getNearestItems",
        {
          input,
        },
      );
      return response;
    }),

  getYearsRange: protectedProcedure
    .input(GetYearsRangeInputSchema)
    .query(async (props) => {
      const { ctx, input } = props;
      const response = await getOrSetCache(
        () => GetYearsRange(props),
        "item",
        "getYearsRange",
        {
          userId: ctx.session.user.id,
          input,
        },
      );
      return response;
    }),

  addToCollection: protectedProcedure
    .input(AddToCollectionInputSchema)
    .mutation(async (props) => {
      const { ctx, input } = props;
      const response = await AddToCollection(props);

      await invalidateItemCaches(ctx.session.user.id, {
        collectionsIds: [input.collectionId],
        includeSearch: true,
      });

      return response;
    }),

  updateItem: protectedProcedure
    .input(UpdateItemInputSchema)
    .mutation(async (props) => {
      const { ctx, input } = props;
      const response = await UpdateItem(props);

      await invalidateItemCaches(ctx.session.user.id, {
        itemId: input.id,
      });

      return response;
    }),

  updateItemImage: protectedProcedure
    .input(UpdateItemImageInputSchema)
    .mutation(async (props) => {
      const { ctx, input } = props;
      const response = await UpdateItemImage(props);

      await invalidateItemCaches(ctx.session.user.id, {
        itemId: input.id,
      });

      return response;
    }),

  deleteFromCollection: protectedProcedure
    .input(DeleteFromCollectionInputSchema)
    .mutation(async (props) => {
      const { ctx, input } = props;
      const response = await DeleteFromCollection(props);

      await invalidateItemCaches(ctx.session.user.id, {
        itemId: input,
        includeSearch: true,
      });

      return response;
    }),

  searchItemByText: protectedProcedure
    .input(SearchItemByTextInputSchema)
    .query(async (props) => {
      const { ctx, input } = props;
      const response = await getOrSetCache(
        () => SearchItemByText(props),
        "item",
        "searchItemByText",
        {
          userId: ctx.session.user.id,
          input,
        },
      );
      return response;
    }),

  getPublicUserItems: publicProcedure
    .input(GetUserItemsInputSchema)
    .query(async (props) => {
      const { ctx, input } = props;

      const response = await getOrSetCache(
        async () => {
          const user = await getFirstAllowedUser(ctx.db);
          if (!user) {
            throw new Error("Public user not found");
          }

          const publicCtx = {
            ...ctx,
            session: {
              user: { id: user.id, email: user.email, name: user.name },
              expires: "",
            },
          };

          return GetUserItems({ ctx: publicCtx, input });
        },
        "item",
        "getPublicUserItems",
        {
          input,
        },
        CACHE_TTL_SECONDS.public,
      );

      return response;
    }),

  getPublicAllUserItems: publicProcedure
    .input(GetAllUserItemsInputSchema)
    .query(async (props) => {
      const { ctx, input } = props;

      const response = await getOrSetCache(
        async () => {
          const user = await getFirstAllowedUser(ctx.db);
          if (!user) {
            throw new Error("Public user not found");
          }

          const publicCtx = {
            ...ctx,
            session: {
              user: { id: user.id, email: user.email, name: user.name },
              expires: "",
            },
          };

          return GetAllUserItems({ ctx: publicCtx, input });
        },
        "item",
        "getPublicAllUserItems",
        {
          input,
        },
        CACHE_TTL_SECONDS.public,
      );

      return response;
    }),

  getPublicRandomUserItems: publicProcedure
    .input(GetRandomUserItemsInputSchema)
    .query(async (props) => {
      const { ctx, input } = props;
      return getOrSetCache(
        async () => {
          const user = await getFirstAllowedUser(ctx.db);
          if (!user) {
            throw new Error("Public user not found");
          }

          const publicCtx = {
            ...ctx,
            session: {
              user: { id: user.id, email: user.email, name: user.name },
              expires: "",
            },
          };

          return GetRandomUserItems({ ctx: publicCtx, input });
        },
        "item",
        "getPublicRandomUserItems",
        { input },
        CACHE_TTL_SECONDS.public,
      );
    }),

  getPublicUserItemsStats: publicProcedure
    .input(GetUserItemsStatsInputSchema)
    .query(async (props) => {
      const { ctx, input } = props;

      const response = await getOrSetCache(
        async () => {
          const user = await getFirstAllowedUser(ctx.db);
          if (!user) {
            throw new Error("Public user not found");
          }

          const publicCtx = {
            ...ctx,
            session: {
              user: { id: user.id, email: user.email, name: user.name },
              expires: "",
            },
          };

          return GetUserItemsStats({ ctx: publicCtx, input });
        },
        "item",
        "getPublicUserItemsStats",
        {
          input,
        },
        CACHE_TTL_SECONDS.public,
      );

      return response;
    }),

  getPublicYearsRange: publicProcedure
    .input(GetYearsRangeInputSchema)
    .query(async (props) => {
      const { ctx, input } = props;

      const response = await getOrSetCache(
        async () => {
          const user = await getFirstAllowedUser(ctx.db);
          if (!user) {
            throw new Error("Public user not found");
          }

          const publicCtx = {
            ...ctx,
            session: {
              user: { id: user.id, email: user.email, name: user.name },
              expires: "",
            },
          };

          return GetYearsRange({ ctx: publicCtx, input });
        },
        "item",
        "getPublicYearsRange",
        {
          input,
        },
        CACHE_TTL_SECONDS.public,
      );

      return response;
    }),
});
