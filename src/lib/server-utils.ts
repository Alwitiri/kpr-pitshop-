import "server-only";
import { db, type Tx } from "./db";
import { makeStoreEan13 } from "./barcode";

/** Atomic sequential numbers: KPR-00001, PO-00001, ... */
export async function nextNumber(tx: Tx, name: string, prefix: string, pad = 5) {
  const c = await tx.counter.upsert({
    where: { name },
    create: { name, value: 1 },
    update: { value: { increment: 1 } },
  });
  return `${prefix}-${String(c.value).padStart(pad, "0")}`;
}

/** Next unused item code KPR-0001… (skips codes already used, e.g. from an Excel import). */
export async function generateSku(tx: Tx) {
  for (;;) {
    const sku = await nextNumber(tx, "sku", "KPR", 4);
    const taken = await tx.product.findUnique({ where: { sku }, select: { id: true } });
    if (!taken) return sku;
  }
}

/** Next unused in-store EAN-13 barcode (21xxxxxxxxxxC). */
export async function generateBarcode(tx: Tx) {
  for (;;) {
    const c = await tx.counter.upsert({ where: { name: "barcode" }, create: { name: "barcode", value: 1 }, update: { value: { increment: 1 } } });
    const code = makeStoreEan13(c.value);
    const taken = await tx.product.findUnique({ where: { barcode: code }, select: { id: true } });
    if (!taken) return code;
  }
}

/** Change stock and write the ledger entry in the same transaction. */
export async function moveStock(
  tx: Tx,
  args: {
    productId: number;
    qty: number; // signed
    type: string;
    refType?: string;
    refId?: number;
    note?: string;
    userId?: number;
  },
) {
  const p = await tx.product.update({
    where: { id: args.productId },
    data: { stock: { increment: args.qty } },
    select: { stock: true },
  });
  await tx.stockMovement.create({
    data: {
      productId: args.productId,
      qty: args.qty,
      balanceAfter: p.stock,
      type: args.type,
      refType: args.refType,
      refId: args.refId,
      note: args.note,
      userId: args.userId,
    },
  });
  return p.stock;
}

export async function audit(
  userId: number | null,
  action: string,
  entity: string,
  entityId?: string | number | null,
  details?: string,
) {
  try {
    await db.auditLog.create({
      data: { userId, action, entity, entityId: entityId == null ? null : String(entityId), details },
    });
  } catch {
    /* audit must never break the main flow */
  }
}

export async function getSettings() {
  return (
    (await db.shopSettings.findUnique({ where: { id: 1 } })) ??
    (await db.shopSettings.create({ data: { id: 1 } }))
  );
}

// ── Form helpers ──
export const str = (fd: FormData, k: string) => {
  const v = fd.get(k);
  return typeof v === "string" ? v.trim() : "";
};
export const optStr = (fd: FormData, k: string) => str(fd, k) || null;
export const num = (fd: FormData, k: string, def = 0) => {
  const s = str(fd, k);
  if (s === "") return def;
  const n = Number(s);
  return Number.isFinite(n) ? n : def;
};
export const optInt = (fd: FormData, k: string) => {
  const s = str(fd, k);
  if (!s) return null;
  const n = parseInt(s, 10);
  return Number.isFinite(n) ? n : null;
};
export const bool = (fd: FormData, k: string) => {
  const v = fd.get(k);
  return v === "on" || v === "true" || v === "1";
};

/** Result type returned by form actions used with <ActionForm>. */
export type ActionResult = { ok?: string; error?: string } | null;

export function errMsg(e: unknown) {
  if (e && typeof e === "object" && "digest" in e && String((e as { digest: unknown }).digest).startsWith("NEXT_REDIRECT")) throw e;
  const m = e instanceof Error ? e.message : String(e);
  if (m.includes("Unique constraint")) return "That value already exists (duplicate SKU, barcode, phone or name).";
  return m;
}
