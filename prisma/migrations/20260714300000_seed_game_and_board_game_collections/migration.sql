-- Seeds are not applied by `prisma migrate deploy`.  Keep the IDs in sync with
-- seedsData.js so existing installations receive the two Add-page collections.
INSERT INTO "Collection" ("id", "name", "slug", "priority", "createdAt", "updatedAt")
VALUES
  ('cmrl220pm0000re46h0k0dqxj', 'Game', 'game', 6, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
  ('cmrl220pp0001re4683ab1dkk', 'Board Game', 'board-game', 7, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
ON CONFLICT ("slug") DO UPDATE
SET "name" = EXCLUDED."name", "priority" = EXCLUDED."priority", "updatedAt" = CURRENT_TIMESTAMP;

-- Existing shared field groups and Game/Board Game-specific fields also need
-- their relations. `name` is the durable key here: installations seeded at
-- different times can have different internal IDs for the original groups.
INSERT INTO "FieldGroup" ("id", "name", "priority", "isFiltering") VALUES
  ('cmrl223ep0000su46d1fn8dsf', 'gameModes', 12, true),
  ('cmrl223es0001su4686kj487k', 'themes', 13, true),
  ('cmrl223es0002su463x2q5046', 'players', 14, false),
  ('cmrl223es0003su46g8d935hv', 'playingTime', 15, false),
  ('cmrl223es0004su464s4s06l0', 'complexity', 16, false),
  ('cmrl223es0005su46be0tf0s6', 'mechanics', 17, true)
ON CONFLICT ("name") DO NOTHING;

INSERT INTO "_CollectionToFieldGroup" ("A", "B")
SELECT c."id", fg."id"
FROM "Collection" c
JOIN "FieldGroup" fg ON (
  (c."slug" = 'game' AND fg."name" IN ('genres', 'contentRating', 'keywords', 'production', 'people', 'platforms', 'gameModes', 'themes'))
  OR (c."slug" = 'board-game' AND fg."name" IN ('genres', 'production', 'people', 'players', 'playingTime', 'complexity', 'mechanics'))
)
ON CONFLICT DO NOTHING;
