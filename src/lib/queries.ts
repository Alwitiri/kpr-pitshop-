import "server-only";
import { db } from "./db";

/** Lightweight product list for pickers (POS, purchases, job cards, adjustments). */
export function pickerProducts() {
  return db.product.findMany({
    where: { active: true },
    select: {
      id: true, name: true, sku: true, barcode: true, stock: true, sellingPrice: true, purchasePrice: true,
      gstRate: true, size: true, color: true, hsn: true, unit: true,
    },
    orderBy: { name: "asc" },
  });
}

/** Products with stock that have not sold in `days` days. */
export async function deadStock(days: number) {
  const since = new Date(Date.now() - days * 864e5);
  const products = await db.product.findMany({
    where: { active: true, stock: { gt: 0 }, createdAt: { lt: since } },
    include: { category: true },
  });
  const recent = await db.saleItem.findMany({
    where: { sale: { date: { gte: since }, status: { not: "CANCELLED" } }, productId: { not: null } },
    select: { productId: true },
    distinct: ["productId"],
  });
  const sold = new Set(recent.map((r) => r.productId));
  const lastSales = await db.saleItem.groupBy({
    by: ["productId"],
    where: { productId: { in: products.map((p) => p.id) }, sale: { status: { not: "CANCELLED" } } },
    _max: { id: true },
  });
  const lastIds = lastSales.map((l) => l._max.id!).filter(Boolean);
  const lastDates = await db.saleItem.findMany({ where: { id: { in: lastIds } }, select: { productId: true, sale: { select: { date: true } } } });
  const lastMap = new Map(lastDates.map((l) => [l.productId, l.sale.date]));
  return products
    .filter((p) => !sold.has(p.id))
    .map((p) => ({ ...p, lastSold: lastMap.get(p.id) ?? null }));
}

/** Customer outstanding = opening + Σ(sale total − returned − paid) − on-account payments. */
export async function customerDues() {
  const sales = await db.sale.groupBy({
    by: ["customerId"],
    where: { customerId: { not: null }, status: { not: "CANCELLED" } },
    _sum: { total: true, paidAmount: true, returnedAmount: true },
  });
  const onAccount = await db.payment.groupBy({
    by: ["customerId"],
    where: { saleId: null, customerId: { not: null } },
    _sum: { amount: true },
  });
  const customers = await db.customer.findMany({ select: { id: true, name: true, phone: true, openingBalance: true } });
  const map = new Map<number, number>();
  for (const c of customers) if (c.openingBalance) map.set(c.id, c.openingBalance);
  for (const s of sales)
    map.set(s.customerId!, (map.get(s.customerId!) ?? 0) + (s._sum.total ?? 0) - (s._sum.returnedAmount ?? 0) - (s._sum.paidAmount ?? 0));
  for (const p of onAccount) map.set(p.customerId!, (map.get(p.customerId!) ?? 0) - (p._sum.amount ?? 0));
  return customers
    .map((c) => ({ ...c, due: Math.round((map.get(c.id) ?? 0) * 100) / 100 }))
    .filter((c) => c.due > 0.5)
    .sort((a, b) => b.due - a.due);
}

/** Supplier balance = opening + purchases − payments − returns. */
export async function supplierBalances() {
  const [suppliers, purchases, payments, returns] = await Promise.all([
    db.supplier.findMany({ select: { id: true, name: true, phone: true, openingBalance: true, active: true } }),
    db.purchase.groupBy({ by: ["supplierId"], _sum: { total: true } }),
    db.supplierPayment.groupBy({ by: ["supplierId"], _sum: { amount: true } }),
    db.purchaseReturn.groupBy({ by: ["supplierId"], _sum: { total: true } }),
  ]);
  const pm = new Map(purchases.map((p) => [p.supplierId, p._sum.total ?? 0]));
  const pay = new Map(payments.map((p) => [p.supplierId, p._sum.amount ?? 0]));
  const ret = new Map(returns.map((p) => [p.supplierId, p._sum.total ?? 0]));
  return suppliers.map((s) => {
    const purchased = pm.get(s.id) ?? 0;
    const paid = pay.get(s.id) ?? 0;
    const returned = ret.get(s.id) ?? 0;
    return { ...s, purchased, paid, returned, balance: Math.round((s.openingBalance + purchased - paid - returned) * 100) / 100 };
  });
}
