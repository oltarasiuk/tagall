import {
  createTRPCRouter,
  protectedProcedure,
  publicProcedure,
} from "~/server/api/trpc";
import { GetAll, GetUserCollections } from "./services";
import { CACHE_TTL_SECONDS, getOrSetCache } from "../../../../lib/redis";
import { getFirstAllowedUser } from "../../helpers";

export const CollectionRouter = createTRPCRouter({
  getAll: protectedProcedure.query(async (props) => {
    const response = await getOrSetCache(
      () => GetAll(props),
      "collection",
      "getAll",
    );
    return response;
  }),
  getUserCollections: protectedProcedure.query(async (props) => {
    const { ctx } = props;
    const response = await getOrSetCache(
      () => GetUserCollections(props),
      "collection",
      "getUserCollections",
      {
        userId: ctx.session.user.id,
      },
    );
    return response;
  }),
  getPublicUserCollections: publicProcedure.query(async (props) => {
    const { ctx } = props;

    const response = await getOrSetCache(
      async () => {
        const user = await getFirstAllowedUser(ctx.db);
        if (!user) {
          throw new Error("Public user not found");
        }

        const collections = await ctx.db.collection.findMany({
          where: {
            items: {
              some: {
                userToItems: {
                  some: {
                    userId: user.id,
                  },
                },
              },
            },
          },
          orderBy: [{ priority: "asc" }],
        });
        return collections;
      },
      "collection",
      "getPublicUserCollections",
      {},
      CACHE_TTL_SECONDS.public,
    );

    return response;
  }),
});
