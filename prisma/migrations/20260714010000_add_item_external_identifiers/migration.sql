-- Provider-aware external identifiers. Purely additive: `Item.parsedId` stays,
-- and the backfill of existing rows runs separately via
-- `pnpm db:backfill-external-identifiers`.

CREATE TYPE "ExternalProvider" AS ENUM (
    'IMDB',
    'TMDB',
    'ANILIST',
    'OPEN_LIBRARY',
    'HARDCOVER',
    'GOOGLE_BOOKS',
    'IGDB',
    'RAWG',
    'STEAM',
    'BGG',
    'VNDB',
    'FANART_TV',
    'STEAMGRIDDB',
    'MANGADEX'
);

ALTER TABLE "Item" ADD COLUMN "originalTitle" TEXT;
ALTER TABLE "Item" ADD COLUMN "originalLanguage" TEXT;
ALTER TABLE "Item" ADD COLUMN "sourceUrl" TEXT;

CREATE TABLE "ItemExternalIdentifier" (
    "id" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "provider" "ExternalProvider" NOT NULL,
    "externalId" TEXT NOT NULL,
    "url" TEXT,
    "isPrimary" BOOLEAN NOT NULL DEFAULT false,
    "itemId" TEXT NOT NULL,

    CONSTRAINT "ItemExternalIdentifier_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "ItemExternalIdentifier_provider_externalId_key" ON "ItemExternalIdentifier"("provider", "externalId");
CREATE INDEX "ItemExternalIdentifier_itemId_idx" ON "ItemExternalIdentifier"("itemId");

ALTER TABLE "ItemExternalIdentifier"
    ADD CONSTRAINT "ItemExternalIdentifier_itemId_fkey"
    FOREIGN KEY ("itemId") REFERENCES "Item"("id") ON DELETE CASCADE ON UPDATE CASCADE;
