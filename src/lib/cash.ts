import "server-only";
import { db } from "./db";
import { dayRange, round2 } from "./format";

/** Money movement for one shop day, split by payment method, with cash drawer math. */
export async function cashSummary(date: string) {
  const range = dayRange(date);
  const [payments, expenses, supplierPays, prevClose] = await Promise.all([
    db.payment.findMany({ where: { date: range }, select: { amount: true, method: true } }),
    db.expense.findMany({ where: { date: range }, select: { amount: true, method: true, category: true } }),
    db.supplierPayment.findMany({ where: { date: range }, select: { amount: true, method: true } }),
    db.dayClose.findFirst({ where: { date: { lt: date } }, orderBy: { date: "desc" } }),
  ]);
  const byMethod: Record<string, { in: number; out: number }> = {};
  const add = (m: string, k: "in" | "out", v: number) => {
    byMethod[m] ??= { in: 0, out: 0 };
    byMethod[m][k] = round2(byMethod[m][k] + v);
  };
  for (const p of payments) (p.amount >= 0 ? add(p.method, "in", p.amount) : add(p.method, "out", -p.amount));
  for (const e of expenses) add(e.method, "out", e.amount);
  for (const s of supplierPays) add(s.method, "out", s.amount);

  const opening = prevClose?.counted ?? 0;
  const cashIn = byMethod.CASH?.in ?? 0;
  const cashOut = byMethod.CASH?.out ?? 0;
  return {
    date,
    opening,
    openingFrom: prevClose?.date ?? null,
    cashIn,
    cashOut,
    expected: round2(opening + cashIn - cashOut),
    byMethod,
    receipts: round2(payments.filter((p) => p.amount > 0).reduce((a, p) => a + p.amount, 0)),
    refunds: round2(payments.filter((p) => p.amount < 0).reduce((a, p) => a - p.amount, 0)),
    expenses: round2(expenses.reduce((a, e) => a + e.amount, 0)),
    supplierPaid: round2(supplierPays.reduce((a, e) => a + e.amount, 0)),
  };
}
