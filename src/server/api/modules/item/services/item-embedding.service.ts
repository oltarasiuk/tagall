import type { ContextType } from "../../../../types";

export const GetNearestItemsIds = async (props: {
  ctx: ContextType;
  embedding: number[];
  limit?: number;
}): Promise<string[]> => {
  const { ctx, embedding, limit = 10 } = props;

  const result = await ctx.db.$queryRaw<{ id: string }[]>`
    SELECT id
    FROM "Item"
    ORDER BY (embedding <-> ${JSON.stringify(embedding)}::vector)
    LIMIT ${limit + 1};
  `;

  return result.map((row) => row.id).slice(1, result.length);
};

export const GetItemEmbedding = async (props: {
  ctx: ContextType;
  itemId: string;
}): Promise<number[]> => {
  const { ctx, itemId } = props;

  const result = await ctx.db.$queryRawUnsafe<{ embedding: string }[]>(
    `
    SELECT embedding::text
    FROM "Item"
    WHERE id = $1;
  `,
    itemId,
  );

  if (!result[0]?.embedding) {
    throw new Error(
      `Item with ID ${itemId} has no embedding yet. Try again in a few seconds.`,
    );
  }

  return JSON.parse(result[0].embedding) as number[];
};

export const UpdateItemEmbedding = async (props: {
  ctx: ContextType;
  embedding: number[];
  itemId: string;
}): Promise<string> => {
  const { ctx, embedding, itemId } = props;
  await ctx.db.$executeRaw`
  UPDATE "Item"
  SET embedding = ${JSON.stringify(embedding)}::vector
  WHERE id = ${itemId};
`;
  return "Item embedding updated successfully";
};
