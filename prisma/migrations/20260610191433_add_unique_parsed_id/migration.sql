-- DropIndex
DROP INDEX "Item_parsedId_idx";

-- CreateIndex
CREATE UNIQUE INDEX "Item_parsedId_key" ON "Item"("parsedId");
