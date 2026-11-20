-- Receipt printing options: 58 mm paper, silent printing, print after every sale
ALTER TABLE "ShopSettings" ADD COLUMN "receiptWidth" TEXT NOT NULL DEFAULT '80mm';
ALTER TABLE "ShopSettings" ADD COLUMN "silentPrint" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "ShopSettings" ADD COLUMN "receiptAutoPrint" BOOLEAN NOT NULL DEFAULT false;
