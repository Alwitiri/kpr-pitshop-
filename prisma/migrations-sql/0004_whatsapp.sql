-- CreateTable
CREATE TABLE "WaTemplate" (
    "key" TEXT NOT NULL PRIMARY KEY,
    "body" TEXT NOT NULL
);

-- CreateTable
CREATE TABLE "WaMessage" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "customerId" INTEGER,
    "phone" TEXT NOT NULL,
    "kind" TEXT NOT NULL,
    "body" TEXT NOT NULL,
    "saleId" INTEGER,
    "jobCardId" INTEGER,
    "followUpId" INTEGER,
    "campaignId" INTEGER,
    "userId" INTEGER,
    "userName" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "WaMessage_customerId_fkey" FOREIGN KEY ("customerId") REFERENCES "Customer" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "WaCampaign" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "name" TEXT NOT NULL,
    "body" TEXT NOT NULL,
    "audience" TEXT,
    "createdById" INTEGER,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- CreateTable
CREATE TABLE "WaCampaignRecipient" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "campaignId" INTEGER NOT NULL,
    "customerId" INTEGER,
    "name" TEXT NOT NULL,
    "phone" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'PENDING',
    "sentAt" DATETIME,
    "sentById" INTEGER,
    CONSTRAINT "WaCampaignRecipient_campaignId_fkey" FOREIGN KEY ("campaignId") REFERENCES "WaCampaign" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- AlterTable (simple column adds – safe on an existing shop database)
ALTER TABLE "ShopSettings" ADD COLUMN "waOpenWith" TEXT NOT NULL DEFAULT 'APP';
ALTER TABLE "ShopSettings" ADD COLUMN "waCountryCode" TEXT NOT NULL DEFAULT '91';

-- CreateIndex
CREATE INDEX "WaMessage_createdAt_idx" ON "WaMessage"("createdAt");

-- CreateIndex
CREATE INDEX "WaMessage_customerId_idx" ON "WaMessage"("customerId");

-- CreateIndex
CREATE INDEX "WaCampaignRecipient_campaignId_status_idx" ON "WaCampaignRecipient"("campaignId", "status");

