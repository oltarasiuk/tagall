-- Record where each item's persisted cover came from, for on-demand usage
-- analysis. Additive and nullable: existing rows keep NULL (unknown source).
ALTER TABLE "Item" ADD COLUMN "artworkSource" TEXT;
