-- A field value was globally unique, so the same text could only ever live in
-- one group: "action" as a genre blocked "action" as a keyword. Scope
-- uniqueness to the group instead.
--
-- Existing rows cannot conflict: they were globally unique, which implies
-- uniqueness within any single group.

DROP INDEX "Field_value_key";

CREATE UNIQUE INDEX "Field_fieldGroupId_value_key" ON "Field"("fieldGroupId", "value");
