import "server-only";
import { db } from "./db";
import { dayRange, round2, ymd } from "./format";

/** Sold items (non-cancelled bills) with returns netted out. Values exclude GST unless named "gross". */
export async function soldItems(from: string, to: string) {
  const items = await db.saleItem.findMany({
    where: { sale: { date: dayRange(from, to), status: { not: "CANCELLED" } } },
    include: {
      sale: { select: { id: true, date: true, userId: true, customerId: true, interState: true } },
      product: { select: { id: true, name: true, sku: true, category: { select: { name: true } }, brand: { select: { name: true } } } },
    },
  });
  return items.map((i) => {
    const keep = i.qty > 0 ? (i.qty - i.returnedQty) / i.qty : 0;
    const netQty = i.qty - i.returnedQty;
    const revenue = round2(i.taxableValue * keep);
    const cost = round2(i.costPrice * netQty);
    return {
      ...i,
      day: ymd(i.sale.date),
      month: ymd(i.sale.date).slice(0, 7),
      netQty,
      revenue,
      tax: round2(i.taxAmount * keep),
      gross: round2(i.total * keep),
      cost,
      profit: i.productId ? round2(revenue - cost) : revenue, // service/labour is all margin
    };
  });
}

export function groupSum<T>(rows: T[], key: (r: T) => string, vals: (r: T) => Record<string, number>) {
  const map = new Map<string, Record<string, number>>();
  for (const r of rows) {
    const k = key(r);
    const v = vals(r);
    const cur = map.get(k) ?? {};
    for (const [f, n] of Object.entries(v)) cur[f] = round2((cur[f] ?? 0) + n);
    map.set(k, cur);
  }
  return [...map.entries()].map(([key, v]) => ({ key, v }));
}

export function daysBetween(from: string, to: string) {
  const out: string[] = [];
  const d = new Date(`${from}T12:00:00+05:30`);
  const end = new Date(`${to}T12:00:00+05:30`);
  while (d <= end && out.length < 400) {
    out.push(ymd(d));
    d.setUTCDate(d.getUTCDate() + 1);
  }
  return out;
}
