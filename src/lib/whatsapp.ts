import "server-only";
import { db } from "./db";
import { fmtDate, money, qty, round2 } from "./format";
import { getSettings } from "./server-utils";
import { WA_DEFAULTS, waPhone, type WaKind } from "./wa-templates";

/** Template text: the owner's wording if saved, otherwise the built-in default. */
export async function templateFor(kind: WaKind) {
  const t = await db.waTemplate.findUnique({ where: { key: kind } });
  return t?.body ?? WA_DEFAULTS[kind];
}

export function fillMessage(t: string, vars: Record<string, string | undefined>) {
  return t
    .replace(/\{(\w+)\}/g, (_, k) => vars[k] ?? "")
    .replace(/[ \t]+\n/g, "\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

/** What one customer owes right now (same rule as the Dues report). */
export async function customerDue(customerId: number) {
  const [c, sales, onAcc] = await Promise.all([
    db.customer.findUnique({ where: { id: customerId }, select: { openingBalance: true } }),
    db.sale.aggregate({ where: { customerId, status: { not: "CANCELLED" } }, _sum: { total: true, returnedAmount: true, paidAmount: true } }),
    db.payment.aggregate({ where: { customerId, saleId: null }, _sum: { amount: true } }),
  ]);
  return round2(
    (c?.openingBalance ?? 0) + (sales._sum.total ?? 0) - (sales._sum.returnedAmount ?? 0) - (sales._sum.paidAmount ?? 0) - (onAcc._sum.amount ?? 0),
  );
}

const vehicleName = (v: { make: string; model: string | null; regNo: string | null } | null | undefined) =>
  v ? [v.make, v.model, v.regNo].filter(Boolean).join(" ") : undefined;

export type ComposeInput = {
  kind: WaKind;
  customerId?: number | null;
  saleId?: number | null;
  jobCardId?: number | null;
  followUpId?: number | null;
  phone?: string | null; // typed by staff when the bill has no number
  body?: string | null; // ready text (offer broadcasts)
};

export type Composed = { phone: string | null; text: string; customerId: number | null; saleId: number | null; jobCardId: number | null };

/** Builds the message for a customer / bill / job / follow-up from its template. */
export async function composeMessage(input: ComposeInput): Promise<Composed> {
  const settings = await getSettings();
  let { customerId = null, saleId = null, jobCardId = null } = input;
  const vars: Record<string, string | undefined> = {
    shop: settings.shopName,
    shop_phone: settings.phone || undefined,
    footer: settings.invoiceFooter || undefined,
  };
  let item: string | undefined;
  let vehicleId: number | null = null;

  if (input.followUpId) {
    const f = await db.followUp.findUnique({ where: { id: input.followUpId } });
    if (f) {
      customerId ??= f.customerId;
      vehicleId = f.vehicleId;
      if (f.refType === "Sale") saleId ??= f.refId;
      if (f.refType === "JobCard") jobCardId ??= f.refId;
      const itemId = f.dedupeKey?.match(/:item:(\d+)$/)?.[1];
      if (itemId) item = (await db.saleItem.findUnique({ where: { id: Number(itemId) }, select: { name: true } }))?.name;
    }
  }

  let phone = input.phone ?? null;
  if (saleId) {
    const s = await db.sale.findUnique({ where: { id: saleId }, include: { items: true, vehicle: true } });
    if (s) {
      customerId ??= s.customerId;
      phone ??= s.customerPhone;
      vehicleId ??= s.vehicleId;
      const due = round2(s.total - s.returnedAmount - s.paidAmount);
      Object.assign(vars, {
        invoice: s.invoiceNo,
        date: fmtDate(s.date),
        items: s.items
          .filter((i) => i.qty > i.returnedQty)
          .map((i) => `• ${i.name}${i.qty - i.returnedQty !== 1 ? ` × ${qty(i.qty - i.returnedQty)}` : ""} – ${money(i.total)}`)
          .join("\n"),
        total: money(s.total - s.returnedAmount),
        paid: money(s.paidAmount),
        customer: s.customerName ?? undefined,
      });
      if (s.vehicle) vars.vehicle = vehicleName(s.vehicle);
      if (input.kind === "INVOICE") vars.due = money(Math.max(0, due));
      if (input.kind === "INVOICE" && due > 0.5) {
        vars.due_line = `\n*Balance due: ${money(due)}*`;
        if (settings.upiId) vars.upi_line = `\nPay by UPI: ${settings.upiId}`;
      }
      item ??= s.items[0]?.name;
    }
  }
  if (jobCardId) {
    const j = await db.jobCard.findUnique({ where: { id: jobCardId }, include: { vehicle: true } });
    if (j) {
      customerId ??= j.customerId;
      vars.job = j.number;
      if (j.vehicle) vars.vehicle = vehicleName(j.vehicle);
    }
  }
  if (customerId) {
    const c = await db.customer.findUnique({ where: { id: customerId }, include: { vehicles: { orderBy: { createdAt: "desc" }, take: 1 } } });
    if (c) {
      vars.customer = c.name;
      phone = phone ?? c.phone ?? c.altPhone;
      if (!vars.vehicle) {
        const v = vehicleId ? await db.vehicle.findUnique({ where: { id: vehicleId } }) : c.vehicles[0];
        vars.vehicle = vehicleName(v);
      }
      if (input.kind !== "INVOICE") {
        const due = await customerDue(c.id);
        vars.due = money(Math.max(0, due));
        if (due > 0.5) {
          vars.due_line = `\nBalance due: ${money(due)}`;
          if (settings.upiId) vars.upi_line = `\nPay by UPI: ${settings.upiId}`;
        }
      }
    }
  }
  vars.customer ??= "Customer";
  vars.vehicle ??= "vehicle";
  vars.item = item ?? "product";

  const template = input.body ?? (await templateFor(input.kind));
  return {
    phone: waPhone(phone, settings.waCountryCode || "91"),
    text: fillMessage(template, vars),
    customerId,
    saleId,
    jobCardId,
  };
}
