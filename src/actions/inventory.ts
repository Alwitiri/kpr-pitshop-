"use server";

import { revalidatePath } from "next/cache";
import { db } from "@/lib/db";
import { requireAction } from "@/lib/auth";
import { audit, errMsg, moveStock, num, optInt, str, type ActionResult } from "@/lib/server-utils";

export async function adjustStock(_: ActionResult, fd: FormData): Promise<ActionResult> {
  try {
    const s = await requireAction("inventory");
    const productId = optInt(fd, "productId");
    if (!productId) return { error: "Choose a product." };
    const mode = str(fd, "mode"); // ADD | REMOVE | DAMAGE | SET
    const q = num(fd, "qty");
    const note = str(fd, "note");
    if (q < 0 || (mode !== "SET" && q === 0)) return { error: "Enter a valid quantity." };
    if ((mode === "REMOVE" || mode === "DAMAGE" || mode === "SET") && !note) return { error: "Please enter a reason." };

    const result = await db.$transaction(async (tx) => {
      const p = await tx.product.findUniqueOrThrow({ where: { id: productId } });
      let delta = 0;
      let type = "ADJUSTMENT";
      if (mode === "ADD") delta = q;
      else if (mode === "REMOVE") delta = -q;
      else if (mode === "DAMAGE") { delta = -q; type = "DAMAGE"; }
      else if (mode === "SET") delta = q - p.stock;
      if (delta === 0) return { name: p.name, stock: p.stock };
      const stock = await moveStock(tx, { productId, qty: delta, type, note, userId: s.uid, refType: "Manual" });
      return { name: p.name, stock };
    });
    await audit(s.uid, "STOCK_ADJUSTED", "Product", productId, `${mode} ${q} – ${note}`);
    revalidatePath("/inventory");
    return { ok: `${result.name}: stock is now ${result.stock}.` };
  } catch (e) {
    return { error: errMsg(e) };
  }
}

export async function saveStockCheck(_: ActionResult, fd: FormData): Promise<ActionResult> {
  try {
    const s = await requireAction("inventory");
    const entries: { id: number; counted: number }[] = [];
    for (const [k, v] of fd.entries()) {
      if (k.startsWith("count_") && typeof v === "string" && v.trim() !== "") {
        const n = Number(v);
        if (Number.isFinite(n) && n >= 0) entries.push({ id: Number(k.slice(6)), counted: n });
      }
    }
    if (!entries.length) return { error: "Enter the counted quantity for at least one product." };
    let changed = 0;
    await db.$transaction(async (tx) => {
      for (const e of entries) {
        const p = await tx.product.findUnique({ where: { id: e.id }, select: { stock: true } });
        if (!p) continue;
        const delta = e.counted - p.stock;
        if (delta !== 0) {
          await moveStock(tx, { productId: e.id, qty: delta, type: "STOCK_CHECK", note: "Physical stock verification", userId: s.uid });
          changed++;
        }
      }
    });
    await audit(s.uid, "STOCK_CHECK", "Inventory", null, `${entries.length} counted, ${changed} corrected`);
    revalidatePath("/inventory");
    return { ok: `${entries.length} items verified. ${changed} stock figures corrected.` };
  } catch (e) {
    return { error: errMsg(e) };
  }
}
