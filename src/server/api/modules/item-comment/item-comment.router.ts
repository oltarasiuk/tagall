import { createTRPCRouter, protectedProcedure } from "~/server/api/trpc";
import {
  UpdateItemCommentInputSchema,
  AddItemCommentInputSchema,
  DeleteItemCommentInputSchema,
  GetUserItemCommentsInputSchema,
} from "./schemas";
import {
  UpdateItemComment,
  AddItemComment,
  DeleteItemComment,
  GetUserItemComments,
} from "./services";
import { deleteCache, getOrSetCache } from "../../../../lib/redis";

export const ItemCommentRouter = createTRPCRouter({
  getUserItemComment: protectedProcedure
    .input(GetUserItemCommentsInputSchema)
    .query(async (props) => {
      const { ctx, input } = props;

      const response = await getOrSetCache(
        () => GetUserItemComments(props),
        "comment",
        "getUserComments",
        {
          userId: ctx.session.user.id,
          input,
        },
      );
      return response;
    }),

  addItemComment: protectedProcedure
    .input(AddItemCommentInputSchema)
    .mutation(async (props) => {
      const { ctx } = props;
      const response = await AddItemComment(props);

      await deleteCache("item", "getUserItemsStats", {
        userId: ctx.session.user.id,
      });
      await deleteCache("item", "getUserItem", {
        userId: ctx.session.user.id,
        input: response.userToItem.itemId,
      });
      await deleteCache("comment", "getUserComments", {
        userId: ctx.session.user.id,
        input: response.userToItem.itemId,
      });

      return "Comment created successfully!";
    }),

  updateItemComment: protectedProcedure
    .input(UpdateItemCommentInputSchema)
    .mutation(async (props) => {
      const { ctx } = props;
      const response = await UpdateItemComment(props);

      await deleteCache("item", "getUserItemsStats", {
        userId: ctx.session.user.id,
      });
      await deleteCache("item", "getUserItem", {
        userId: ctx.session.user.id,
        input: response.userToItem.itemId,
      });
      await deleteCache("comment", "getUserComments", {
        userId: ctx.session.user.id,
        input: response.userToItem.itemId,
      });

      return "Comment updated successfully!";
    }),

  deleteItemComment: protectedProcedure
    .input(DeleteItemCommentInputSchema)
    .mutation(async (props) => {
      const { ctx } = props;
      const response = await DeleteItemComment(props);

      await deleteCache("item", "getUserItemsStats", {
        userId: ctx.session.user.id,
      });
      await deleteCache("item", "getUserItem", {
        userId: ctx.session.user.id,
        input: response.userToItem.itemId,
      });
      await deleteCache("comment", "getUserComments", {
        userId: ctx.session.user.id,
        input: response.userToItem.itemId,
      });
      return "Comment deleted successfully!";
    }),
});
