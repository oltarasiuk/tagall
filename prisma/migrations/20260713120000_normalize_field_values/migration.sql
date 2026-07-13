-- Field values are used as filter identities. PostgreSQL's default text
-- comparison is case-sensitive, so legacy values such as "Action" and
-- "action" could coexist and produce separate filters.
--
-- Preserve every item relation while merging each case/whitespace-insensitive
-- duplicate into one canonical field. Prefer an already-normalized value when
-- it exists; otherwise keep the lexicographically first id.
WITH normalized_fields AS (
  SELECT
    "id",
    first_value("id") OVER (
      PARTITION BY lower(btrim("value"))
      ORDER BY
        CASE WHEN "value" = lower(btrim("value")) THEN 0 ELSE 1 END,
        "id"
    ) AS canonical_id
  FROM "Field"
)
INSERT INTO "_FieldToItem" ("A", "B")
SELECT normalized_fields.canonical_id, field_to_item."B"
FROM "_FieldToItem" AS field_to_item
JOIN normalized_fields ON normalized_fields."id" = field_to_item."A"
WHERE normalized_fields."id" <> normalized_fields.canonical_id
ON CONFLICT ("A", "B") DO NOTHING;

WITH normalized_fields AS (
  SELECT
    "id",
    first_value("id") OVER (
      PARTITION BY lower(btrim("value"))
      ORDER BY
        CASE WHEN "value" = lower(btrim("value")) THEN 0 ELSE 1 END,
        "id"
    ) AS canonical_id
  FROM "Field"
)
DELETE FROM "Field" AS field
USING normalized_fields
WHERE field."id" = normalized_fields."id"
  AND normalized_fields."id" <> normalized_fields.canonical_id;

UPDATE "Field"
SET "value" = lower(btrim("value"))
WHERE "value" IS DISTINCT FROM lower(btrim("value"));

ALTER TABLE "Field"
ADD CONSTRAINT "Field_value_is_normalized"
CHECK ("value" = lower(btrim("value")));
