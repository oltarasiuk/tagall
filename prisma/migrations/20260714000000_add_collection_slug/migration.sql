-- Add a stable routing key for collections. Display names stay free to change.

-- 1. Nullable column first, so existing rows survive.
ALTER TABLE "Collection" ADD COLUMN "slug" TEXT;

-- 2. Backfill from the current display names: "Board Game" -> "board-game".
UPDATE "Collection"
SET "slug" = lower(regexp_replace(trim("name"), '\s+', '-', 'g'))
WHERE "slug" IS NULL;

-- 3. Lock it down. A duplicate slug fails here instead of silently merging routes.
ALTER TABLE "Collection" ALTER COLUMN "slug" SET NOT NULL;
CREATE UNIQUE INDEX "Collection_slug_key" ON "Collection"("slug");
