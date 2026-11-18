"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { db } from "@/lib/db";
import { requireAction } from "@/lib/auth";
import { round2, parseDay } from "@/lib/format";
import { audit, bool, errMsg, moveStock, nextNumber, num, optInt, optStr, str, type ActionResult } from "@/lib/server-utils";
import { saveUpload } from "@/lib/storage";

export async function saveSupplier(_: ActionResult, fd: FormData): Promise<ActionResult> {
  let id = optInt(fd, "id");
  try {
    const s = await requireAction("suppliers");
    const name = str(fd, "name");
    if (!name) return { error: "Supplier name is required." };
    const data = {
      name,
      contactPerson: optStr(fd, "contactPerson"),
      phone: optStr(fd, "phone"),
      email: optStr(fd, "email"),
      gstin: optStr(fd, "gstin")?.toUpperCase() ?? null,
      address: optStr(fd, "address"),
      openingBalance: num(fd, "openingBalance"),
      notes: optStr(fd, "notes"),
      active: id ? bool(fd, "active") : true,
    };
    if (id) await db.supplier.update({ where: { id }, data });
    else id = (await db.supplier.create({ data })).id;
    await audit(s.uid, "SUPPLIER_SAVED", "Supplier", id, name);
  } catch (e) {
    return { error: errMsg(e) };
  }
  revalidatePath("/suppliers");
  if (fd.get("_new")) redirect(`/suppliers/${id}`);
  return { ok: "Supplier saved." };
}

type PurchaseLineIn = { productId: number; qty: number; unitCost: number; gstRate: number };

export async function createPurchase(_: ActionResult, fd: FormData): Promise<ActionResult> {
  let id = 0;
  try {
    const s = await requireAction("purchases");
    const supplierId = optInt(fd, "supplierId");
    if (!supplierId) return { error: "Choose a supplier." };
    let lines: PurchaseLineIn[] = [];
    try {
      lines = JSON.parse(str(fd, "lines") || "[]");
    } catch {
      return { error: "Invalid item list." };
    }
    lines = lines.filter((l) => l.productId && l.qty > 0);
    if (!lines.length) return { error: "Add at least one product." };
    if (lines.some((l) => l.unitCost < 0)) return { error: "Cost cannot be negative." };

    const otherCharges = num(fd, "otherCharges");
    const discount = num(fd, "discount");
    const paid = num(fd, "paidAmount");
    const method = str(fd, "paymentMethod") || "CASH";
    const updateCost = bool(fd, "updateCost");
    const date = parseDay(str(fd, "date"));
    const attachmentUrl = await saveUpload(fd.get("attachment") as File | null, "purchases");

    const items = lines.map((l) => {
      const base = round2(l.qty * l.unitCost);
      const tax = round2((base * l.gstRate) / 100);
      return { productId: l.productId, qty: l.qty, unitCost: l.unitCost, gstRate: l.gstRate, taxAmount: tax, total: round2(base + tax) };
    });
    const subtotal = round2(items.reduce((a, i) => a + i.qty * i.unitCost, 0));
    const taxTotal = round2(items.reduce((a, i) => a + i.taxAmount, 0));
    const total = round2(subtotal + taxTotal + otherCharges - discount);
    if (paid > total + 0.01) return { error: "Paid amount is more than the bill total." };

    id = await db.$transaction(async (tx) => {
      const number = await nextNumber(tx, "purchase", "PO");
      const p = await tx.purchase.create({
        data: {
          number, supplierId, supplierBillNo: optStr(fd, "supplierBillNo"), date, subtotal, taxTotal, otherCharges, discount,
          total, paidAmount: paid, notes: optStr(fd, "notes"), attachmentUrl, createdById: s.uid, items: { create: items },
        },
      });
      for (const i of items) {
        await moveStock(tx, { productId: i.productId, qty: i.qty, type: "PURCHASE", refType: "Purchase", refId: p.id, userId: s.uid, note: number });
        const prod = await tx.product.findUniqueOrThrow({ where: { id: i.productId }, select: { supplierId: true } });
        await tx.product.update({
          where: { id: i.productId },
          data: { ...(updateCost ? { purchasePrice: i.unitCost } : {}), ...(prod.supplierId ? {} : { supplierId }) },
        });
      }
      if (paid > 0) {
        await tx.supplierPayment.create({ data: { supplierId, purchaseId: p.id, amount: paid, method, date, note: `Paid with ${number}` } });
      }
      return p.id;
    });
    await audit(s.uid, "PURCHASE_CREATED", "Purchase", id, `Total ${total}`);
  } catch (e) {
    return { error: errMsg(e) };
  }
  revalidatePath("/purchases");
  revalidatePath("/inventory");
  redirect(`/purchases/${id}`);
}

/** Pay a supplier. With a purchase: applied to that bill. Without: applied to oldest unpaid bills first. */
export async function addSupplierPayment(_: ActionResult, fd: FormData): Promise<ActionResult> {
  try {
    const s = await requireAction("purchases");
    const supplierId = optInt(fd, "supplierId");
    const purchaseId = optInt(fd, "purchaseId");
    let amount = num(fd, "amount");
    const method = str(fd, "method") || "CASH";
    const reference = optStr(fd, "reference");
    const date = parseDay(str(fd, "date"));
    if (!supplierId || amount <= 0) return { error: "Enter a valid amount." };

    await db.$transaction(async (tx) => {
      const bills = purchaseId
        ? await tx.purchase.findMany({ where: { id: purchaseId } })
        : await tx.purchase.findMany({ where: { supplierId }, orderBy: { date: "asc" } });
      for (const b of bills) {
        if (amount <= 0) break;
        const returned = (await tx.purchaseReturn.aggregate({ where: { purchaseId: b.id }, _sum: { total: true } }))._sum.total ?? 0;
        const due = round2(b.total - returned - b.paidAmount);
        if (due <= 0 && !purchaseId) continue;
        const apply = purchaseId ? amount : Math.min(amount, due);
        await tx.purchase.update({ where: { id: b.id }, data: { paidAmount: { increment: apply } } });
        await tx.supplierPayment.create({ data: { supplierId, purchaseId: b.id, amount: apply, method, reference, date, note: optStr(fd, "note") } });
        amount = round2(amount - apply);
      }
      if (amount > 0) {
        // advance / opening balance payment
        await tx.supplierPayment.create({ data: { supplierId, amount, method, reference, date, note: optStr(fd, "note") ?? "On account" } });
      }
    });
    await audit(s.uid, "SUPPLIER_PAYMENT", "Supplier", supplierId, `${num(fd, "amount")} ${method}`);
    revalidatePath(`/suppliers/${supplierId}`);
    revalidatePath("/purchases");
    return { ok: "Payment recorded." };
  } catch (e) {
    return { error: errMsg(e) };
  }
}

export async function createPurchaseReturn(_: ActionResult, fd: FormData): Promise<ActionResult> {
  try {
    const s = await requireAction("purchases");
    const purchaseId = optInt(fd, "purchaseId");
    if (!purchaseId) return { error: "Missing purchase." };
    const purchase = await db.purchase.findUniqueOrThrow({ where: { id: purchaseId }, include: { items: { include: { product: true } } } });
    const lines: { itemId: number; productId: number; name: string; qty: number; unitCost: number; total: number }[] = [];
    for (const it of purchase.items) {
      const q = num(fd, `ret_${it.id}`);
      if (q <= 0) continue;
      const stock = it.product.stock;
      if (q > it.qty - it.returnedQty) return { error: `Cannot return more ${it.product.name} than purchased.` };
      if (q > stock) return { error: `Only ${stock} of ${it.product.name} in stock.` };
      lines.push({ itemId: it.id, productId: it.productId, name: it.product.name, qty: q, unitCost: it.unitCost, total: round2(q * it.unitCost * (1 + it.gstRate / 100)) });
    }
    if (!lines.length) return { error: "Enter a quantity to return." };
    const total = round2(lines.reduce((a, l) => a + l.total, 0));
    await db.$transaction(async (tx) => {
      const number = await nextNumber(tx, "purchase_return", "PR");
      const r = await tx.purchaseReturn.create({
        data: { number, supplierId: purchase.supplierId, purchaseId, total, note: optStr(fd, "note"), items: JSON.stringify(lines) },
      });
      for (const l of lines) {
        await tx.purchaseItem.update({ where: { id: l.itemId }, data: { returnedQty: { increment: l.qty } } });
        await moveStock(tx, { productId: l.productId, qty: -l.qty, type: "PURCHASE_RETURN", refType: "Purchase", refId: purchaseId, userId: s.uid, note: number });
      }
      return r;
    });
    await audit(s.uid, "PURCHASE_RETURN", "Purchase", purchaseId, `Total ${total}`);
    revalidatePath(`/purchases/${purchaseId}`);
    return { ok: `Return of ${total.toFixed(2)} recorded. The supplier balance is reduced.` };
  } catch (e) {
    return { error: errMsg(e) };
  }
}
