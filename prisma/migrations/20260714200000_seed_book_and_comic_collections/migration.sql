-- Collections were previously introduced through prisma/seed.js only. Existing
-- environments do not run the seed during `prisma migrate deploy`, so Book and
-- Comic never appeared there. Keep the fixed ids used by the seed for stable
-- relations and make the migration safe to apply more than once.
INSERT INTO "Collection" ("id", "name", "slug", "priority", "createdAt", "updatedAt")
VALUES
  ('cm3bnlxhu00020ks7hyps1g0a', 'Book', 'book', 3, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
  ('cmi75xx8zbqwcuglg4iivite7', 'Comic', 'comic', 5, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
ON CONFLICT ("slug") DO UPDATE
SET
  "name" = EXCLUDED."name",
  "priority" = EXCLUDED."priority",
  "updatedAt" = CURRENT_TIMESTAMP;
