-- CreateTable
CREATE TABLE "BinLocation" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "shop" TEXT NOT NULL,
    "location" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- CreateIndex
CREATE UNIQUE INDEX "BinLocation_shop_location_key" ON "BinLocation"("shop", "location");

-- CreateIndex
CREATE INDEX "BinLocation_shop_idx" ON "BinLocation"("shop");
