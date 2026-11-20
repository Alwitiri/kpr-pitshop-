-- CreateTable
CREATE TABLE "RolePermission" (
    "role" TEXT NOT NULL PRIMARY KEY,
    "perms" TEXT NOT NULL
);

-- CreateTable
CREATE TABLE "FollowUp" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "customerId" INTEGER,
    "vehicleId" INTEGER,
    "type" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "notes" TEXT,
    "dueDate" DATETIME NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'OPEN',
    "outcome" TEXT,
    "assignedToId" INTEGER,
    "ruleId" INTEGER,
    "refType" TEXT,
    "refId" INTEGER,
    "dedupeKey" TEXT,
    "createdById" INTEGER,
    "doneAt" DATETIME,
    "doneById" INTEGER,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "FollowUp_customerId_fkey" FOREIGN KEY ("customerId") REFERENCES "Customer" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "FollowUp_assignedToId_fkey" FOREIGN KEY ("assignedToId") REFERENCES "User" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "FollowUp_ruleId_fkey" FOREIGN KEY ("ruleId") REFERENCES "WorkflowRule" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "CustomerInteraction" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "customerId" INTEGER NOT NULL,
    "type" TEXT NOT NULL,
    "note" TEXT NOT NULL,
    "userId" INTEGER,
    "userName" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "CustomerInteraction_customerId_fkey" FOREIGN KEY ("customerId") REFERENCES "Customer" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "WorkflowRule" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "name" TEXT NOT NULL,
    "trigger" TEXT NOT NULL,
    "delayDays" INTEGER NOT NULL DEFAULT 0,
    "followUpType" TEXT NOT NULL DEFAULT 'CALL',
    "title" TEXT NOT NULL,
    "minAmount" REAL NOT NULL DEFAULT 0,
    "assignUserId" INTEGER,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- CreateIndex
CREATE UNIQUE INDEX "FollowUp_dedupeKey_key" ON "FollowUp"("dedupeKey");

-- CreateIndex
CREATE INDEX "FollowUp_status_dueDate_idx" ON "FollowUp"("status", "dueDate");

-- CreateIndex
CREATE INDEX "FollowUp_customerId_idx" ON "FollowUp"("customerId");

-- CreateIndex
CREATE INDEX "CustomerInteraction_customerId_createdAt_idx" ON "CustomerInteraction"("customerId", "createdAt");


-- Default workflow rules (the owner can edit, switch off or add more in Settings → Workflows)
INSERT INTO "WorkflowRule" ("name", "trigger", "delayDays", "followUpType", "title", "minAmount", "active") VALUES
  ('Thank-you & feedback call', 'SALE_CREATED', 2, 'FEEDBACK', 'Feedback call: {customer} – bill {invoice} ({amount})', 2000, 1),
  ('Collect pending payment', 'PAYMENT_DUE', 7, 'PAYMENT', 'Collect {amount} due from {customer} (bill {invoice})', 0, 1),
  ('Vehicle ready – call to collect', 'JOB_COMPLETED', 0, 'CALL', 'Call {customer}: {vehicle} is ready ({job})', 0, 1),
  ('Next service reminder', 'JOB_DELIVERED', 90, 'SERVICE_DUE', 'Service due: {customer} – {vehicle}', 0, 1),
  ('Birthday wish', 'BIRTHDAY', 1, 'BIRTHDAY', 'Birthday wish for {customer}', 0, 1),
  ('Warranty ending – offer replacement', 'WARRANTY_EXPIRING', 15, 'WARRANTY', 'Warranty of {item} ends soon – {customer}', 0, 1),
  ('Win back inactive customer', 'INACTIVE_CUSTOMER', 120, 'WIN_BACK', 'Not visited for a while: {customer}', 0, 0);
