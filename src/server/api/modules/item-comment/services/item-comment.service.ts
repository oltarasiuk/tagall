import type { ContextType } from "../../../../types";
import { ItemCommentResponseClass } from "../item-comment-response.class";
import type {
  AddItemCommentInputType,
  CommentType,
  DeleteItemCommentInputType,
  GetUserItemCommentsInputType,
  UpdateItemCommentInputType,
} from "../types";

const CommentResponse = new ItemCommentResponseClass();

export async function GetUserItemComments(props: {
  ctx: ContextType;
  input: GetUserItemCommentsInputType;
}): Promise<CommentType[]> {
  const { ctx, input } = props;

  const item = await ctx.db.item.findUnique({
    where: { id: input },
  });

  if (!item) {
    throw new Error("Item not found");
  }

  const userToItem = await ctx.db.userToItem.findUnique({
    where: {
      userId_itemId: {
        userId: ctx.session.user.id,
        itemId: item.id,
      },
    },
  });

  if (!userToItem) {
    throw new Error("Item not found in your collection!");
  }

  const comments = await ctx.db.itemComment.findMany({
    where: {
      userToItemId: userToItem.id,
    },
    orderBy: {
      createdAt: "desc",
    },
  });

  return CommentResponse.transformUserItemComments(comments);
}

export async function AddItemComment(props: {
  ctx: ContextType;
  input: AddItemCommentInputType;
}) {
  const { ctx, input } = props;

  const item = await ctx.db.item.findUnique({
    where: { id: input.itemId },
  });

  if (!item) {
    throw new Error("Item not found");
  }

  const userToItem = await ctx.db.userToItem.findUnique({
    where: {
      userId_itemId: {
        userId: ctx.session.user.id,
        itemId: input.itemId,
      },
    },
  });

  if (!userToItem) {
    throw new Error("Item not found in your collection!");
  }

  await ctx.db.item.update({
    where: {
      id: input.itemId,
    },
    data: {
      updatedAt: new Date(),
    },
  });

  const comment = await ctx.db.itemComment.create({
    data: {
      title: input.title ? input.title : null,
      description: input.description ? input.description : null,
      userToItemId: userToItem.id,
      rate: input.rate ?? null,
      status: input.status,
    },
    include: {
      userToItem: true,
    },
  });

  return comment;
}

export async function UpdateItemComment(props: {
  ctx: ContextType;
  input: UpdateItemCommentInputType;
}) {
  const { ctx, input } = props;

  const itemComment = await ctx.db.itemComment.findUnique({
    where: {
      id: input.id,
    },
    include: {
      userToItem: true,
    },
  });

  if (!itemComment) {
    throw new Error("Comment not found!");
  }

  if (itemComment.userToItem.userId !== ctx.session.user.id) {
    throw new Error("Comment not found!");
  }

  await ctx.db.item.update({
    where: {
      id: itemComment.userToItem.itemId,
    },
    data: {
      updatedAt: new Date(),
    },
  });

  const comment = await ctx.db.itemComment.update({
    where: {
      id: input.id,
    },
    data: {
      title: input.title ? input.title : null,
      description: input.description ? input.description : null,
      rate: input.rate,
      status: input.status,
    },
    include: {
      userToItem: true,
    },
  });
  return comment;
}

export async function DeleteItemComment(props: {
  ctx: ContextType;
  input: DeleteItemCommentInputType;
}) {
  const { ctx, input } = props;

  const itemComment = await ctx.db.itemComment.findUnique({
    where: {
      id: input,
    },
    include: {
      userToItem: true,
    },
  });

  if (!itemComment) {
    throw new Error("Comment not found!");
  }

  if (itemComment.userToItem.userId !== ctx.session.user.id) {
    throw new Error("Comment not found!");
  }

  await ctx.db.item.update({
    where: {
      id: itemComment.userToItem.itemId,
    },
    data: {
      updatedAt: new Date(),
    },
  });

  return await ctx.db.itemComment.delete({
    where: {
      id: input,
    },
    include: {
      userToItem: true,
    },
  });
}

// #endregion public functions
