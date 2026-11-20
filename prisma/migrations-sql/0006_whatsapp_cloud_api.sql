-- Optional automatic sending through the official WhatsApp Cloud API
ALTER TABLE "ShopSettings" ADD COLUMN "waMode" TEXT NOT NULL DEFAULT 'CLICK';
ALTER TABLE "ShopSettings" ADD COLUMN "waCloudPhoneId" TEXT;
ALTER TABLE "ShopSettings" ADD COLUMN "waCloudWabaId" TEXT;
ALTER TABLE "ShopSettings" ADD COLUMN "waCloudToken" TEXT;
ALTER TABLE "ShopSettings" ADD COLUMN "waCloudVersion" TEXT NOT NULL DEFAULT 'v22.0';
ALTER TABLE "ShopSettings" ADD COLUMN "waCloudTemplates" TEXT;
ALTER TABLE "ShopSettings" ADD COLUMN "waAutoInvoice" BOOLEAN NOT NULL DEFAULT false;

ALTER TABLE "WaTemplate" ADD COLUMN "cloudTemplate" TEXT;
ALTER TABLE "WaTemplate" ADD COLUMN "cloudLang" TEXT;
ALTER TABLE "WaTemplate" ADD COLUMN "cloudParams" TEXT;

ALTER TABLE "WaMessage" ADD COLUMN "channel" TEXT NOT NULL DEFAULT 'CLICK';
ALTER TABLE "WaMessage" ADD COLUMN "waId" TEXT;
ALTER TABLE "WaMessage" ADD COLUMN "error" TEXT;
ALTER TABLE "WaMessage" ADD COLUMN "attempts" INTEGER NOT NULL DEFAULT 0;
ALTER TABLE "WaMessage" ADD COLUMN "sendAfter" DATETIME;
ALTER TABLE "WaMessage" ADD COLUMN "recipientId" INTEGER;

ALTER TABLE "WorkflowRule" ADD COLUMN "autoWhatsApp" BOOLEAN NOT NULL DEFAULT false;

ALTER TABLE "WaCampaignRecipient" ADD COLUMN "error" TEXT;

-- CreateIndex
CREATE INDEX "WaMessage_status_sendAfter_idx" ON "WaMessage"("status", "sendAfter");
