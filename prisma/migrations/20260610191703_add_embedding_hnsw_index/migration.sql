-- HNSW index for nearest-neighbour search on Item.embedding.
-- Operator class must match the query operator: the app uses `<->` (L2), hence vector_l2_ops.
-- NOTE: lives only in SQL; Prisma cannot model indexes on Unsupported() columns,
-- so `prisma migrate diff` may report drift. This is expected.
CREATE INDEX IF NOT EXISTS "Item_embedding_hnsw_idx"
ON "Item"
USING hnsw (embedding vector_l2_ops);
