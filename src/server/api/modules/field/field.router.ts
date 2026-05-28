import {
  createTRPCRouter,
  protectedProcedure,
  publicProcedure,
} from "~/server/api/trpc";
import {
  GetFilterFieldsInputSchema,
  GetItemDetailFieldsInputSchema,
} from "./schemas";
import { GetFilterFields, GetItemDetailFields } from "./services";
import { CACHE_TTL_SECONDS, getOrSetCache } from "../../../../lib/redis";
import { getFirstAllowedUser } from "../../helpers";

export const FieldRouter = createTRPCRouter({
  getFilterFields: protectedProcedure
    .input(GetFilterFieldsInputSchema)
    .query(async (props) => {
      const { ctx, input } = props;
      const response = await getOrSetCache(
        () => GetFilterFields(props),
        "field",
        "getFilterFields",
        {
          userId: ctx.session.user.id,
          input,
        },
      );
      return response;
    }),

  getItemDetailFields: protectedProcedure
    .input(GetItemDetailFieldsInputSchema)
    .query(async (props) => {
      const { input } = props;
      const response = await getOrSetCache(
        () => GetItemDetailFields(props),
        "field",
        "getItemDetailFields",
        {
          input,
        },
      );
      return response;
    }),

  getPublicFilterFields: publicProcedure
    .input(GetFilterFieldsInputSchema)
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

          return GetFilterFields({ ctx: publicCtx, input });
        },
        "field",
        "getPublicFilterFields",
        {
          input,
        },
        CACHE_TTL_SECONDS.public,
      );

      return response;
    }),
});
