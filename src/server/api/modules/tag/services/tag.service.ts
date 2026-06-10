import type { ContextType } from "../../../../types";
import type {
  AddTagInputType,
  DeleteTagInputType,
  GetUserTagsInputType,
  UpdateTagInputType,
} from "../types";
import type { TagType } from "../types/tag.type";
import { normalizeText } from "~/utils/normalize-text";

export async function GetUserTags(props: {
  ctx: ContextType;
  input: GetUserTagsInputType;
}): Promise<TagType[]> {
  const { ctx, input } = props;

  const tags = await ctx.db.tag.findMany({
    where: {
      userId: ctx.session.user.id,
      collections: {
        some: {
          id: {
            in: input,
          },
        },
      },
    },
    include: {
      collections: true,
      _count: {
        select: {
          userToItems: true,
        },
      },
    },
    orderBy: {
      name: "asc",
    },
  });

  return tags;
}

export async function AddTag(props: {
  ctx: ContextType;
  input: AddTagInputType;
}) {
  const { ctx, input } = props;

  // Normalize tag name: lowercase + trim for consistency
  const normalizedName = normalizeText(input.name);

  if (!normalizedName) {
    throw new Error("Tag name cannot be empty!");
  }

  await ctx.db.tag.create({
    data: {
      name: normalizedName,
      userId: ctx.session.user.id,
      ...(input.collectionsIds?.length && {
        collections: {
          connect: input.collectionsIds?.map((id) => ({ id })),
        },
      }),
    },
  });

  return "Tag created successfully!";
}

export async function UpdateTag(props: {
  ctx: ContextType;
  input: UpdateTagInputType;
}) {
  const { ctx, input } = props;

  const tag = await ctx.db.tag.findUnique({
    where: {
      id: input.id,
    },
  });

  if (tag?.userId !== ctx.session.user.id) {
    throw new Error("Tag not found!");
  }

  // Normalize tag name: lowercase + trim for consistency
  const normalizedName =
    input.name !== undefined ? normalizeText(input.name) : undefined;

  if (input.name !== undefined && !normalizedName) {
    throw new Error("Tag name cannot be empty!");
  }

  await ctx.db.tag.update({
    where: {
      id: input.id,
    },
    data: {
      ...(normalizedName && { name: normalizedName }),
      ...(input.collectionsIds?.length && {
        collections: {
          set: input.collectionsIds?.map((id) => ({ id })),
        },
      }),
    },
  });

  return "Tag updated successfully!";
}

export async function DeleteTag(props: {
  ctx: ContextType;
  input: DeleteTagInputType;
}) {
  const { ctx, input } = props;

  const tag = await ctx.db.tag.findUnique({
    where: {
      id: input,
    },
  });

  if (tag?.userId !== ctx.session.user.id) {
    throw new Error("Tag not found!");
  }

  await ctx.db.tag.delete({
    where: {
      id: input,
    },
  });

  return "Tag deleted successfully!";
}

// #endregion public functions
