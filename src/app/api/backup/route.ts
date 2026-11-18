import { db } from "@/lib/db";
import { getSession } from "@/lib/auth";
import { ymd } from "@/lib/format";
import { audit } from "@/lib/server-utils";

export async function GET() {
  const s = await getSession();
  if (!s || s.role !== "OWNER") return new Response("Only the owner can download backups.", { status: 403 });

  const data = {
    exportedAt: new Date().toISOString(),
    version: 1,
    settings: await db.shopSettings.findMany(),
    counters: await db.counter.findMany(),
    users: (await db.user.findMany()).map(({ passwordHash: _p, ...u }) => u),
    categories: await db.category.findMany(),
    brands: await db.brand.findMany(),
    suppliers: await db.supplier.findMany(),
    products: await db.product.findMany(),
    fitments: await db.productFitment.findMany(),
    stockMovements: await db.stockMovement.findMany(),
    purchases: await db.purchase.findMany({ include: { items: true } }),
    supplierPayments: await db.supplierPayment.findMany(),
    purchaseReturns: await db.purchaseReturn.findMany(),
    customers: await db.customer.findMany(),
    vehicles: await db.vehicle.findMany(),
    sales: await db.sale.findMany({ include: { items: true } }),
    payments: await db.payment.findMany(),
    saleReturns: await db.saleReturn.findMany(),
    jobCards: await db.jobCard.findMany({ include: { parts: true } }),
    expenses: await db.expense.findMany(),
    dayCloses: await db.dayClose.findMany(),
    attendance: await db.attendance.findMany(),
  };
  await audit(s.uid, "BACKUP_DOWNLOADED", "System");
  return new Response(JSON.stringify(data, null, 1), {
    headers: {
      "Content-Type": "application/json",
      "Content-Disposition": `attachment; filename="kpr-backup-${ymd()}.json"`,
    },
  });
}
