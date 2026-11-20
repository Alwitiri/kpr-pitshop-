-- WhatsApp messages made while the internet is down wait in a queue
ALTER TABLE "WaMessage" ADD COLUMN "status" TEXT NOT NULL DEFAULT 'OPENED';
ALTER TABLE "WaMessage" ADD COLUMN "openedAt" DATETIME;
UPDATE "WaMessage" SET "openedAt" = "createdAt";

-- CreateIndex
CREATE INDEX "WaMessage_status_idx" ON "WaMessage"("status");
