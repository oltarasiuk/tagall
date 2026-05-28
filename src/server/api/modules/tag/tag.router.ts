import { createTRPCRouter, protectedProcedure } from "~/server/api/trpc";
import {
  AddTagInputSchema,
  DeleteTagInputSchema,
  GetUserTagsInputSchema,
  UpdateTagInputSchema,
} from "./schemas";
import { AddTag, DeleteTag, GetUserTags, UpdateTag } from "./services";
import { deleteCache, getOrSetCache } from "../../../../lib/redis";

export const TagRouter = createTRPCRouter({
  getUserTags: protectedProcedure
    .input(GetUserTagsInputSchema)
    .query(async (props) => {
      const { ctx } = props;
      const response = await getOrSetCache(
        () => GetUserTags(props),
        "tag",
        "getUserTags",
        {
          userId: ctx.session.user.id,
        },
      );
      return response;
    }),

  addTag: protectedProcedure
    .input(AddTagInputSchema)
    .mutation(async (props) => {
      const { ctx } = props;
      const response = await AddTag(props);
      await deleteCache("tag", "getUserTags", {
        userId: ctx.session.user.id,
      });
      return response;
    }),

  updateTag: protectedProcedure
    .input(UpdateTagInputSchema)
    .mutation(async (props) => {
      const { ctx } = props;
      const response = await UpdateTag(props);
      await deleteCache("tag", "getUserTags", {
        userId: ctx.session.user.id,
      });
      return response;
    }),

  deleteTag: protectedProcedure
    .input(DeleteTagInputSchema)
    .mutation(async (props) => {
      const { ctx } = props;
      const response = await DeleteTag(props);
      await deleteCache("tag", "getUserTags", {
        userId: ctx.session.user.id,
      });
      return response;
    }),
});
