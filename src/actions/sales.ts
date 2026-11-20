"use server";

import { revalidatePath } from "next/cache";
import { db, like } from "@/lib/db";
import { requireAction } from "@/lib/auth";
import { can, type Module } from "@/lib/roles";
import { calcBill, saleStatus, type CartLine } from "@/lib/calc";
import { closePaidFollowUps, fireEvent } from "@/lib/workflows";
import { round2, parseDay } from "@/lib/format";
import { audit, errMsg, getSettings, moveStock, nextNumber, num, optInt, optStr, str, type ActionResult } from "@/lib/server-utils";

export type SalePayload = {
  lines: CartLine[];
  billDiscount: number;
  interState: boolean;
  customerId?: number | null;
  newCustomer?: { name: string; phone: string; whatsappOptIn: boolean; vehicle?: { type: string; make: string; model: string; regNo: string } } | null;
  walkInName?: string;
  vehicleId?: number | null;
  payments: { method: string; amount: number; reference?: string }[];
  notes?: string;
  jobCardId?: number | null;
};

export async function createSale(payload: SalePayload): Promise<{ ok?: boolean; error?: string; saleId?: number; invoiceNo?: string }> {
  try {
    const s = await requireAction("pos");
    const lines = (payload.lines ?? []).filter((l) => l.qty > 0);
    if (!lines.length) return { error: "The bill is empty." };
    if (lines.some((l) => l.unitPrice < 0 || l.discount < 0)) return { error: "Prices and discounts cannot be negative." };

    const ids = lines.map((l) => l.productId).filter((x): x is number => !!x);
    const products = await db.product.findMany({ where: { id: { in: ids } } });
    const pmap = new Map(products.map((p) => [p.id, p]));

    // Stock check (sum quantities per product in case the same item appears twice)
    const need = new Map<number, number>();
    for (const l of lines) if (l.productId) need.set(l.productId, (need.get(l.productId) ?? 0) + l.qty);
    for (const [pid, q] of need) {
      const p = pmap.get(pid);
      if (!p) return { error: "A product in the bill no longer exists." };
      if (p.stock < q) return { error: `Not enough stock for ${p.name}. Available: ${p.stock}.` };
    }

    // Authoritative values from DB (GST rate, HSN) – price can be edited at the counter.
    const clean: CartLine[] = lines.map((l) => {
      const p = l.productId ? pmap.get(l.productId) : null;
      return {
        productId: p?.id ?? null,
        name: p ? p.name + (p.size ? ` (${p.size})` : "") : (l.name || "Service").slice(0, 120),
        hsn: p?.hsn ?? l.hsn ?? null,
        qty: l.qty,
        unitPrice: round2(l.unitPrice),
        discount: round2(l.discount || 0),
        gstRate: p ? p.gstRate : [0, 5, 12, 18, 28].includes(l.gstRate) ? l.gstRate : 18,
      };
    });
    const bill = calcBill(clean, payload.billDiscount || 0, !!payload.interState);

    // Payments: cash over-tender is change, not revenue.
    let pays = (payload.payments ?? []).filter((p) => p.amount > 0).map((p) => ({ ...p, amount: round2(p.amount) }));
    let paidSum = round2(pays.reduce((a, p) => a + p.amount, 0));
    if (paidSum > bill.total) {
      let excess = round2(paidSum - bill.total);
      pays = pays.map((p) => {
        if (excess > 0 && p.method === "CASH") {
          const cut = Math.min(excess, p.amount);
          excess = round2(excess - cut);
          return { ...p, amount: round2(p.amount - cut) };
        }
        return p;
      }).filter((p) => p.amount > 0);
      if (excess > 0) return { error: "Card/UPI amounts are more than the bill total." };
      paidSum = bill.total;
    }

    const hasCustomer = !!payload.customerId || !!payload.newCustomer?.phone;
    if (paidSum < bill.total - 0.5 && !hasCustomer) return { error: "Select or add a customer to give credit (part payment)." };
    if (payload.newCustomer && !/^[0-9+\s-]{10,15}$/.test(payload.newCustomer.phone.trim())) return { error: "Enter a valid mobile number for the new customer." };

    const settings = await getSettings();

    const sale = await db.$transaction(async (tx) => {
      let customerId = payload.customerId ?? null;
      let vehicleId = payload.vehicleId ?? null;
      if (!customerId && payload.newCustomer?.phone) {
        const nc = payload.newCustomer;
        const phone = nc.phone.replace(/\s|-/g, "");
        const existing = await tx.customer.findUnique({ where: { phone } });
        const c = existing ?? (await tx.customer.create({
          data: {
            name: nc.name || "Customer",
            phone,
            whatsappOptIn: nc.whatsappOptIn,
            optInAt: nc.whatsappOptIn ? new Date() : null,
            optInSource: nc.whatsappOptIn ? "POS counter" : null,
          },
        }));
        customerId = c.id;
        if (nc.vehicle?.make) {
          const v = await tx.vehicle.create({ data: { customerId: c.id, type: nc.vehicle.type || "BIKE", make: nc.vehicle.make, model: nc.vehicle.model || null, regNo: nc.vehicle.regNo?.toUpperCase() || null } });
          vehicleId = v.id;
        }
      }
      const customer = customerId ? await tx.customer.findUnique({ where: { id: customerId } }) : null;

      const invoiceNo = await nextNumber(tx, "invoice", settings.invoicePrefix);
      const now = new Date();
      const costTotal = round2(bill.lines.reduce((a, l) => a + (l.productId ? (pmap.get(l.productId)?.purchasePrice ?? 0) * l.qty : 0), 0));
      const created = await tx.sale.create({
        data: {
          invoiceNo,
          customerId,
          vehicleId,
          customerName: customer?.name ?? (payload.walkInName?.trim() || null),
          customerPhone: customer?.phone ?? null,
          date: now,
          subtotal: bill.subtotal,
          discount: bill.discount,
          taxableValue: bill.taxableValue,
          cgst: bill.cgst,
          sgst: bill.sgst,
          igst: bill.igst,
          taxTotal: bill.taxTotal,
          roundOff: bill.roundOff,
          total: bill.total,
          paidAmount: paidSum,
          costTotal,
          interState: !!payload.interState,
          status: saleStatus(bill.total, paidSum),
          notes: payload.notes?.trim() || null,
          userId: s.uid,
          jobCardId: payload.jobCardId ?? null,
          items: {
            create: bill.lines.map((l) => {
              const p = l.productId ? pmap.get(l.productId) : null;
              return {
                productId: l.productId,
                name: l.name,
                hsn: l.hsn,
                qty: l.qty,
                unitPrice: l.unitPrice,
                discount: l.discount,
                gstRate: l.gstRate,
                taxableValue: l.taxableValue,
                taxAmount: l.taxAmount,
                total: l.total,
                costPrice: p?.purchasePrice ?? 0,
                warrantyUntil: p?.warrantyMonths ? new Date(new Date(now).setMonth(now.getMonth() + p.warrantyMonths)) : null,
              };
            }),
          },
          payments: { create: pays.map((p) => ({ amount: p.amount, method: p.method, reference: p.reference || null, customerId, userId: s.uid, date: now })) },
        },
      });
      for (const l of bill.lines) {
        if (!l.productId) continue;
        const after = await moveStock(tx, { productId: l.productId, qty: -l.qty, type: "SALE", refType: "Sale", refId: created.id, userId: s.uid, note: invoiceNo });
        if (after < 0) throw new Error(`Not enough stock for ${l.name}.`);
      }
      if (payload.jobCardId) {
        await tx.jobCard.update({ where: { id: payload.jobCardId }, data: { status: "DELIVERED", deliveredAt: now } });
      }
      return created;
    });

    await audit(s.uid, "SALE_CREATED", "Sale", sale.id, `${sale.invoiceNo} ₹${sale.total}`);
    // Workflow automation (feedback calls, payment reminders, next service…)
    if (sale.customerId) {
      const base = { customerId: sale.customerId, vehicleId: sale.vehicleId, refType: "Sale", refId: sale.id, invoice: sale.invoiceNo };
      await fireEvent("SALE_CREATED", { ...base, amount: sale.total });
      const due = round2(sale.total - sale.paidAmount);
      if (due > 0.5) await fireEvent("PAYMENT_DUE", { ...base, amount: due });
      if (payload.jobCardId) {
        const job = await db.jobCard.findUnique({ where: { id: payload.jobCardId }, select: { number: true, vehicleId: true } });
        await fireEvent("JOB_DELIVERED", { customerId: sale.customerId, vehicleId: job?.vehicleId ?? sale.vehicleId, refType: "JobCard", refId: payload.jobCardId, job: job?.number });
      }
    }
    revalidatePath("/sales");
    revalidatePath("/");
    return { ok: true, saleId: sale.id, invoiceNo: sale.invoiceNo };
  } catch (e) {
    return { error: errMsg(e) };
  }
}

export async function searchCustomers(q: string) {
  const s = await requireAction();
  if (!["pos", "customers", "jobcards"].some((m) => can(s.role, m as Module))) throw new Error("Not allowed.");
  const t = q.trim();
  if (t.length < 2) return [];
  return db.customer.findMany({
    where: { OR: [{ name: like(t) }, { phone: { contains: t.replace(/\s/g, "") } }, { vehicles: { some: { regNo: like(t) } } }] },
    include: { vehicles: true },
    take: 10,
    orderBy: { name: "asc" },
  });
}

// ── Held bills ──
export async function holdBill(label: string, data: string) {
  const s = await requireAction("pos");
  await db.heldBill.create({ data: { label: label || "Held bill", data, userId: s.uid } });
  return listHeldBills();
}
export async function listHeldBills() {
  await requireAction("pos");
  return db.heldBill.findMany({ orderBy: { createdAt: "desc" } });
}
export async function deleteHeldBill(id: number) {
  await requireAction("pos");
  await db.heldBill.delete({ where: { id } }).catch(() => null);
  return listHeldBills();
}

// ── After-sale operations ──
export async function addSalePayment(_: ActionResult, fd: FormData): Promise<ActionResult> {
  try {
    const s = await requireAction("sales");
    const saleId = optInt(fd, "saleId");
    const amount = num(fd, "amount");
    if (!saleId || amount <= 0) return { error: "Enter a valid amount." };
    const sale = await db.sale.findUniqueOrThrow({ where: { id: saleId } });
    if (sale.status === "CANCELLED") return { error: "This bill is cancelled." };
    const due = round2(sale.total - sale.returnedAmount - sale.paidAmount);
    if (amount > due + 0.01) return { error: `Only ${due.toFixed(2)} is due on this bill.` };
    await db.$transaction(async (tx) => {
      await tx.payment.create({ data: { saleId, customerId: sale.customerId, amount, method: str(fd, "method") || "CASH", reference: optStr(fd, "reference"), note: optStr(fd, "note"), date: parseDay(str(fd, "date")), userId: s.uid } });
      const paid = round2(sale.paidAmount + amount);
      await tx.sale.update({ where: { id: saleId }, data: { paidAmount: paid, status: saleStatus(sale.total - sale.returnedAmount, paid) } });
    });
    await audit(s.uid, "SALE_PAYMENT", "Sale", saleId, String(amount));
    await closePaidFollowUps(sale.customerId, [saleId]);
    revalidatePath(`/sales/${saleId}`);
    return { ok: "Payment received." };
  } catch (e) {
    return { error: errMsg(e) };
  }
}

/** Customer pays dues: applied to the oldest unpaid bills first; any extra is kept on account. */
export async function receiveCustomerPayment(_: ActionResult, fd: FormData): Promise<ActionResult> {
  try {
    const s = await requireAction("customers");
    const customerId = optInt(fd, "customerId");
    let amount = num(fd, "amount");
    if (!customerId || amount <= 0) return { error: "Enter a valid amount." };
    const method = str(fd, "method") || "CASH";
    const date = parseDay(str(fd, "date"));
    await db.$transaction(async (tx) => {
      const sales = await tx.sale.findMany({ where: { customerId, status: { in: ["PARTIAL", "UNPAID"] } }, orderBy: { date: "asc" } });
      for (const sale of sales) {
        if (amount <= 0) break;
        const due = round2(sale.total - sale.returnedAmount - sale.paidAmount);
        if (due <= 0) continue;
        const apply = Math.min(due, amount);
        await tx.payment.create({ data: { saleId: sale.id, customerId, amount: apply, method, reference: optStr(fd, "reference"), date, userId: s.uid, note: optStr(fd, "note") } });
        const paid = round2(sale.paidAmount + apply);
        await tx.sale.update({ where: { id: sale.id }, data: { paidAmount: paid, status: saleStatus(sale.total - sale.returnedAmount, paid) } });
        amount = round2(amount - apply);
      }
      if (amount > 0) {
        await tx.payment.create({ data: { customerId, amount, method, reference: optStr(fd, "reference"), date, userId: s.uid, note: optStr(fd, "note") ?? "On account / opening balance" } });
      }
    });
    await audit(s.uid, "CUSTOMER_PAYMENT", "Customer", customerId, `${num(fd, "amount")} ${method}`);
    await closePaidFollowUps(customerId);
    revalidatePath(`/customers/${customerId}`);
    return { ok: "Payment received and applied to oldest bills." };
  } catch (e) {
    return { error: errMsg(e) };
  }
}

export async function cancelSale(_: ActionResult, fd: FormData): Promise<ActionResult> {
  try {
    const s = await requireAction("sales");
    if (!can(s.role, "manageSales")) return { error: "You do not have permission to cancel bills." };
    const saleId = optInt(fd, "saleId");
    const reason = str(fd, "reason");
    if (!saleId || !reason) return { error: "Enter a reason for cancelling." };
    const sale = await db.sale.findUniqueOrThrow({ where: { id: saleId }, include: { items: true, returns: true } });
    if (sale.status === "CANCELLED") return { error: "Already cancelled." };
    if (sale.returns.length) return { error: "This bill has returns. Cancel is not allowed – use returns instead." };
    await db.$transaction(async (tx) => {
      for (const i of sale.items) {
        if (i.productId) await moveStock(tx, { productId: i.productId, qty: i.qty, type: "SALE_CANCEL", refType: "Sale", refId: sale.id, userId: s.uid, note: `Cancelled ${sale.invoiceNo}` });
      }
      if (sale.paidAmount > 0) {
        await tx.payment.create({ data: { saleId, customerId: sale.customerId, amount: -sale.paidAmount, method: str(fd, "refundMethod") || "CASH", note: "Refund on bill cancellation", userId: s.uid } });
      }
      await tx.sale.update({ where: { id: saleId }, data: { status: "CANCELLED", cancelledAt: new Date(), cancelReason: reason, paidAmount: 0 } });
      if (sale.jobCardId) await tx.jobCard.update({ where: { id: sale.jobCardId }, data: { status: "COMPLETED", deliveredAt: null } });
    });
    await audit(s.uid, "SALE_CANCELLED", "Sale", saleId, reason);
    // Follow-ups created for this bill (feedback, payment…) are no longer needed
    await db.followUp.updateMany({ where: { status: "OPEN", refType: "Sale", refId: saleId }, data: { status: "SKIPPED", outcome: "Bill cancelled", doneAt: new Date() } });
    revalidatePath(`/sales/${saleId}`);
    return { ok: "Bill cancelled. Stock restored." };
  } catch (e) {
    return { error: errMsg(e) };
  }
}

export async function createSaleReturn(_: ActionResult, fd: FormData): Promise<ActionResult> {
  try {
    const s = await requireAction("sales");
    const saleId = optInt(fd, "saleId");
    if (!saleId) return { error: "Missing bill." };
    const refundMethod = str(fd, "refundMethod") || "CASH";
    const sale = await db.sale.findUniqueOrThrow({ where: { id: saleId }, include: { items: true } });
    if (sale.status === "CANCELLED") return { error: "This bill is cancelled." };

    const lines: { saleItemId: number; productId: number | null; name: string; qty: number; amount: number }[] = [];
    for (const it of sale.items) {
      const q = num(fd, `ret_${it.id}`);
      if (q <= 0) continue;
      if (q > it.qty - it.returnedQty) return { error: `Cannot return more ${it.name} than sold (${it.qty - it.returnedQty} left).` };
      lines.push({ saleItemId: it.id, productId: it.productId, name: it.name, qty: q, amount: round2((it.total / it.qty) * q) });
    }
    if (!lines.length) return { error: "Enter a quantity to return." };
    const amount = round2(lines.reduce((a, l) => a + l.amount, 0));
    const due = round2(sale.total - sale.returnedAmount - sale.paidAmount);
    if (refundMethod === "ADJUST_DUE" && amount > due + 0.01) return { error: `Only ${due.toFixed(2)} is due – refund the rest in cash/UPI.` };
    if (refundMethod !== "ADJUST_DUE" && amount > sale.paidAmount + 0.01) return { error: "Refund is more than the amount paid on this bill. Use 'Adjust against dues'." };

    let number = "";
    await db.$transaction(async (tx) => {
      number = await nextNumber(tx, "sale_return", "SR");
      await tx.saleReturn.create({ data: { number, saleId, total: amount, refundMethod, reason: optStr(fd, "reason"), items: JSON.stringify(lines), userId: s.uid } });
      for (const l of lines) {
        await tx.saleItem.update({ where: { id: l.saleItemId }, data: { returnedQty: { increment: l.qty } } });
        if (l.productId && str(fd, "restock") !== "no") {
          await moveStock(tx, { productId: l.productId, qty: l.qty, type: "SALE_RETURN", refType: "Sale", refId: saleId, userId: s.uid, note: number });
        }
      }
      let paid = sale.paidAmount;
      if (refundMethod !== "ADJUST_DUE") {
        await tx.payment.create({ data: { saleId, customerId: sale.customerId, amount: -amount, method: refundMethod, note: `Refund ${number}`, userId: s.uid } });
        paid = round2(paid - amount);
      }
      const returned = round2(sale.returnedAmount + amount);
      await tx.sale.update({ where: { id: saleId }, data: { returnedAmount: returned, paidAmount: paid, status: saleStatus(sale.total - returned, paid) } });
    });
    await audit(s.uid, "SALE_RETURN", "Sale", saleId, `${number} ₹${amount}`);
    revalidatePath(`/sales/${saleId}`);
    return { ok: `Return ${number} saved: ₹${amount.toFixed(2)} ${refundMethod === "ADJUST_DUE" ? "adjusted against dues" : `refunded by ${refundMethod}`}.` };
  } catch (e) {
    return { error: errMsg(e) };
  }
}
