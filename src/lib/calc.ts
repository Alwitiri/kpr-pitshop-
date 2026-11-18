// Bill maths shared by the POS screen (preview) and the server (authoritative).
// Selling prices are GST-inclusive, as is normal for retail in India.
import { round2 } from "./format";

export type CartLine = {
  productId: number | null;
  name: string;
  hsn?: string | null;
  qty: number;
  unitPrice: number; // incl GST
  discount: number; // line discount, rupees
  gstRate: number;
};

export type LineCalc = CartLine & {
  taxableValue: number;
  taxAmount: number;
  total: number; // after line discount and share of bill discount
};

export function calcBill(lines: CartLine[], billDiscount: number, interState: boolean) {
  const lineNet = lines.map((l) => Math.max(0, l.qty * l.unitPrice - (l.discount || 0)));
  const netSum = lineNet.reduce((a, b) => a + b, 0);
  const bd = Math.min(Math.max(0, billDiscount || 0), netSum);

  const calc: LineCalc[] = lines.map((l, i) => {
    const share = netSum > 0 ? (lineNet[i] / netSum) * bd : 0;
    const gross = round2(lineNet[i] - share);
    const taxable = round2(gross / (1 + l.gstRate / 100));
    return { ...l, taxableValue: taxable, taxAmount: round2(gross - taxable), total: gross };
  });

  const subtotal = round2(lines.reduce((a, l) => a + l.qty * l.unitPrice, 0));
  const lineDiscounts = round2(lines.reduce((a, l) => a + (l.discount || 0), 0));
  const taxableValue = round2(calc.reduce((a, l) => a + l.taxableValue, 0));
  const taxTotal = round2(calc.reduce((a, l) => a + l.taxAmount, 0));
  const exact = round2(taxableValue + taxTotal);
  const total = Math.round(exact);
  const half = round2(taxTotal / 2);

  return {
    lines: calc,
    subtotal,
    discount: round2(lineDiscounts + bd),
    taxableValue,
    taxTotal,
    cgst: interState ? 0 : half,
    sgst: interState ? 0 : round2(taxTotal - half),
    igst: interState ? taxTotal : 0,
    roundOff: round2(total - exact),
    total,
  };
}

/** GST rate-wise summary for invoices and GST reports */
export function gstSummary(items: { gstRate: number; taxableValue: number; taxAmount: number }[]) {
  const map = new Map<number, { rate: number; taxable: number; tax: number }>();
  for (const i of items) {
    const r = map.get(i.gstRate) ?? { rate: i.gstRate, taxable: 0, tax: 0 };
    r.taxable = round2(r.taxable + i.taxableValue);
    r.tax = round2(r.tax + i.taxAmount);
    map.set(i.gstRate, r);
  }
  return [...map.values()].sort((a, b) => a.rate - b.rate);
}

export function saleStatus(total: number, paid: number) {
  if (total <= 0) return "PAID";
  if (paid >= total - 0.5) return "PAID";
  if (paid > 0) return "PARTIAL";
  return "UNPAID";
}

export const PAYMENT_METHODS = ["CASH", "UPI", "CARD", "BANK", "CHEQUE"] as const;
export const GST_RATES = [0, 5, 12, 18, 28] as const;
export const EXPENSE_CATEGORIES = [
  "RENT", "ELECTRICITY", "SALARY", "TRANSPORT", "MAINTENANCE", "TEA_SNACKS", "MARKETING", "INTERNET_PHONE", "OTHER",
] as const;
export const JOB_STATUSES = ["RECEIVED", "INSPECTION", "IN_PROGRESS", "COMPLETED", "DELIVERED", "CANCELLED"] as const;

export const label = (s: string) =>
  s.toLowerCase().split("_").map((w) => w[0]?.toUpperCase() + w.slice(1)).join(" ");
