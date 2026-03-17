-- CreateTable
CREATE TABLE "Session" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "shop" TEXT NOT NULL,
    "state" TEXT NOT NULL,
    "isOnline" BOOLEAN NOT NULL DEFAULT false,
    "scope" TEXT,
    "expires" DATETIME,
    "accessToken" TEXT NOT NULL,
    "userId" BIGINT,
    "firstName" TEXT,
    "lastName" TEXT,
    "email" TEXT,
    "accountOwner" BOOLEAN NOT NULL DEFAULT false,
    "locale" TEXT,
    "collaborator" BOOLEAN DEFAULT false,
    "emailVerified" BOOLEAN DEFAULT false,
    "refreshToken" TEXT,
    "refreshTokenExpires" DATETIME
);

-- CreateTable
CREATE TABLE "ScanLog" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "shop" TEXT NOT NULL,
    "orderId" TEXT NOT NULL,
    "status" TEXT NOT NULL,
    "scannedBy" TEXT,
    "timestamp" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "details" TEXT,
    "staffEmail" TEXT
);

-- CreateTable
CREATE TABLE "AppSettings" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "shop" TEXT NOT NULL,
    "adminName" TEXT NOT NULL DEFAULT 'Admin',
    "adminPin" TEXT NOT NULL DEFAULT '1234',
    "brandLogo" TEXT,
    "showStockTab" BOOLEAN NOT NULL DEFAULT true,
    "showOrdersTab" BOOLEAN NOT NULL DEFAULT true,
    "showHistoryTab" BOOLEAN NOT NULL DEFAULT true,
    "enableScanButton" BOOLEAN NOT NULL DEFAULT true,
    "enableInventorySearch" BOOLEAN NOT NULL DEFAULT true,
    "enableInventorySort" BOOLEAN NOT NULL DEFAULT true,
    "showStaffManagement" BOOLEAN NOT NULL DEFAULT true,
    "showLogoutButton" BOOLEAN NOT NULL DEFAULT true
);

-- CreateTable
CREATE TABLE "Staff" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "shop" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "pin" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- CreateIndex
CREATE UNIQUE INDEX "AppSettings_shop_key" ON "AppSettings"("shop");

-- CreateIndex
CREATE UNIQUE INDEX "Staff_shop_email_key" ON "Staff"("shop", "email");
