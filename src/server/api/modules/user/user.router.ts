import {
  createTRPCRouter,
  protectedProcedure,
  publicProcedure,
} from "~/server/api/trpc";
import { GetUser, UpdateUser } from "./services";
import { UpdateUserInputSchema } from "./schemas";
import {
  CACHE_TTL_SECONDS,
  deleteCache,
  getOrSetCache,
} from "../../../../lib/redis";
import { getFirstAllowedUser } from "../../helpers";

export const UserRouter = createTRPCRouter({
  getUser: protectedProcedure.query(async (props) => {
    const { ctx } = props;
    const response = await getOrSetCache(
      () => GetUser(props),
      "user",
      "getUser",
      {
        userId: ctx.session.user.id,
      },
    );
    return response;
  }),

  getPublicUser: publicProcedure.query(async (props) => {
    const { ctx } = props;

    const response = await getOrSetCache(
      async () => {
        const user = await getFirstAllowedUser(ctx.db);
        if (!user) {
          throw new Error("Public user not found");
        }
        return user;
      },
      "user",
      "getPublicUser",
      {},
      CACHE_TTL_SECONDS.public,
    );

    return response;
  }),

  updateUser: protectedProcedure
    .input(UpdateUserInputSchema)
    .mutation(async (props) => {
      const { ctx } = props;
      const response = await UpdateUser(props);
      await deleteCache("user", "getUser", {
        userId: ctx.session.user.id,
      });
      await deleteCache("user", "getPublicUser");
      return response;
    }),
});
