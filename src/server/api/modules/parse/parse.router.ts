import { createTRPCRouter, protectedProcedure } from "~/server/api/trpc";
import { AddIdToSearchResults, Search, ParseRegrex } from "./services";
import { SearchInputSchema, ParseRegrexInputSchema } from "./schemas";
import { getOrSetCache } from "../../../../lib/redis";

export const ParseRouter = createTRPCRouter({
  search: protectedProcedure.input(SearchInputSchema).query(async (props) => {
    const { ctx, input } = props;
    const response = await getOrSetCache(
      () => Search(props),
      "parse",
      "search",
      {
        userId: ctx.session.user.id,
        input,
      },
    );
    return AddIdToSearchResults({ ...props, items: response });
  }),

  regrex: protectedProcedure
    .input(ParseRegrexInputSchema)
    .mutation(async (props) => {
      const { ctx, input } = props;
      const response = await getOrSetCache(
        () => ParseRegrex(props),
        "parse",
        "regrex",
        {
          userId: ctx.session.user.id,
          input,
        },
      );
      return response;
    }),
});
