"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { db } from "@/lib/db";
import { requireAction } from "@/lib/auth";
import { audit, bool, errMsg, moveStock, nextNumber, num, optInt, optStr, str, type ActionResult } from "@/lib/server-utils";
import { saveUpload } from "@/lib/storage";

type FitmentIn = { vehicleType: string; make: string; model?: string; yearFrom?: number | null; yearTo?: number | null };

export async function saveProduct(_: ActionResult, fd: FormData): Promise<ActionResult> {
  let id = optInt(fd, "id");
  try {
    const s = await requireAction("products");
    const name = str(fd, "name");
    if (!name) return { error: "Product name is required." };
    const sellingPrice = num(fd, "sellingPrice");
    if (sellingPrice < 0) return { error: "Selling price cannot be negative." };

    let fitments: FitmentIn[] = [];
    try {
      fitments = JSON.parse(str(fd, "fitments") || "[]");
    } catch {
      fitments = [];
    }
    fitments = fitments.filter((f) => f.make?.trim());

    const image = await saveUpload(fd.get("image") as File | null, "products");

    const data = {
      name,
      barcode: optStr(fd, "barcode"),
      categoryId: optInt(fd, "categoryId"),
      brandId: optInt(fd, "brandId"),
      supplierId: optInt(fd, "supplierId"),
      variantGroup: optStr(fd, "variantGroup"),
      size: optStr(fd, "size"),
      color: optStr(fd, "color"),
      unit: str(fd, "unit") || "PCS",
      hsn: optStr(fd, "hsn"),
      purchasePrice: num(fd, "purchasePrice"),
      sellingPrice,
      mrp: num(fd, "mrp"),
      gstRate: num(fd, "gstRate", 18),
      minStock: num(fd, "minStock", 5),
      warrantyMonths: Math.round(num(fd, "warrantyMonths")),
      description: optStr(fd, "description"),
      location: optStr(fd, "location"),
      active: id ? bool(fd, "active") : true,
      ...(image ? { imageUrl: image } : {}),
    };
    const fitCreate = fitments.map((f) => ({
      vehicleType: f.vehicleType === "CAR" ? "CAR" : "BIKE",
      make: f.make.trim(),
      model: f.model?.trim() || null,
      yearFrom: f.yearFrom || null,
      yearTo: f.yearTo || null,
    }));

    if (id) {
      await db.$transaction(async (tx) => {
        const sku = str(fd, "sku");
        await tx.product.update({ where: { id: id! }, data: { ...data, ...(sku ? { sku } : {}) } });
        await tx.productFitment.deleteMany({ where: { productId: id! } });
        if (fitCreate.length) await tx.productFitment.createMany({ data: fitCreate.map((f) => ({ ...f, productId: id! })) });
      });
      await audit(s.uid, "PRODUCT_UPDATED", "Product", id, name);
    } else {
      const opening = num(fd, "openingStock");
      const created = await db.$transaction(async (tx) => {
        const sku = str(fd, "sku") || (await nextNumber(tx, "sku", "KPR", 4));
        const p = await tx.product.create({ data: { ...data, sku, stock: 0, fitments: { create: fitCreate } } });
        if (opening > 0) await moveStock(tx, { productId: p.id, qty: opening, type: "OPENING", note: "Opening stock", userId: s.uid });
        return p;
      });
      id = created.id;
      await audit(s.uid, "PRODUCT_CREATED", "Product", id, name);
    }
  } catch (e) {
    return { error: errMsg(e) };
  }
  revalidatePath("/products");
  if (fd.get("_new")) redirect(`/products/${id}?saved=1`);
  return { ok: "Product saved." };
}

export async function deleteProduct(fd: FormData) {
  const s = await requireAction("products");
  const id = Number(fd.get("id"));
  const used = await db.saleItem.count({ where: { productId: id } }) + (await db.purchaseItem.count({ where: { productId: id } }));
  if (used > 0) {
    // keep history – just deactivate
    await db.product.update({ where: { id }, data: { active: false } });
    await audit(s.uid, "PRODUCT_DEACTIVATED", "Product", id);
  } else {
    await db.product.delete({ where: { id } });
    await audit(s.uid, "PRODUCT_DELETED", "Product", id);
  }
  revalidatePath("/products");
  redirect("/products");
}

// ── Categories & brands ──
export async function saveCategory(_: ActionResult, fd: FormData): Promise<ActionResult> {
  try {
    await requireAction("products");
    const name = str(fd, "name");
    if (!name) return { error: "Name is required." };
    await db.category.create({ data: { name, type: str(fd, "type") || "BOTH" } });
    revalidatePath("/products/masters");
    return { ok: `Category "${name}" added.` };
  } catch (e) {
    return { error: errMsg(e) };
  }
}

export async function saveBrand(_: ActionResult, fd: FormData): Promise<ActionResult> {
  try {
    await requireAction("products");
    const name = str(fd, "name");
    if (!name) return { error: "Name is required." };
    await db.brand.create({ data: { name } });
    revalidatePath("/products/masters");
    return { ok: `Brand "${name}" added.` };
  } catch (e) {
    return { error: errMsg(e) };
  }
}

export async function deleteMaster(fd: FormData) {
  await requireAction("products");
  const id = Number(fd.get("id"));
  if (fd.get("kind") === "category") await db.category.delete({ where: { id } });
  else await db.brand.delete({ where: { id } });
  revalidatePath("/products/masters");
}

// ── CSV import ──
function parseCsv(text: string): string[][] {
  const rows: string[][] = [];
  let row: string[] = [], cell = "", q = false;
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (q) {
      if (c === '"' && text[i + 1] === '"') { cell += '"'; i++; }
      else if (c === '"') q = false;
      else cell += c;
    } else if (c === '"') q = true;
    else if (c === ",") { row.push(cell); cell = ""; }
    else if (c === "\n" || c === "\r") {
      if (c === "\r" && text[i + 1] === "\n") i++;
      row.push(cell); cell = "";
      if (row.some((x) => x.trim())) rows.push(row);
      row = [];
    } else cell += c;
  }
  row.push(cell);
  if (row.some((x) => x.trim())) rows.push(row);
  return rows;
}

export async function importProducts(_: ActionResult, fd: FormData): Promise<ActionResult> {
  try {
    const s = await requireAction("products");
    const file = fd.get("file") as File | null;
    if (!file || file.size === 0) return { error: "Choose a CSV file (save your Excel sheet as CSV)." };
    const rows = parseCsv((await file.text()).replace(/^﻿/, ""));
    if (rows.length < 2) return { error: "The file has no data rows." };
    const header = rows[0].map((h) => h.trim().toLowerCase().replace(/[\s-]+/g, "_"));
    const col = (r: string[], k: string) => {
      const i = header.indexOf(k);
      return i >= 0 ? (r[i] ?? "").trim() : "";
    };
    if (!header.includes("name")) return { error: 'Missing "name" column. Download the template to see the format.' };

    let created = 0, updated = 0;
    const errors: string[] = [];
    const catCache = new Map<string, number>();
    const brandCache = new Map<string, number>();

    for (let r = 1; r < rows.length; r++) {
      const row = rows[r];
      const name = col(row, "name");
      if (!name) continue;
      try {
        await db.$transaction(async (tx) => {
          let categoryId: number | null = null;
          const cat = col(row, "category");
          if (cat) {
            if (!catCache.has(cat)) catCache.set(cat, (await tx.category.upsert({ where: { name: cat }, create: { name: cat }, update: {} })).id);
            categoryId = catCache.get(cat)!;
          }
          let brandId: number | null = null;
          const br = col(row, "brand");
          if (br) {
            if (!brandCache.has(br)) brandCache.set(br, (await tx.brand.upsert({ where: { name: br }, create: { name: br }, update: {} })).id);
            brandId = brandCache.get(br)!;
          }
          const n = (k: string, d = 0) => {
            const v = Number(col(row, k).replace(/[₹,]/g, ""));
            return col(row, k) === "" || !Number.isFinite(v) ? d : v;
          };
          const data = {
            name, categoryId, brandId,
            barcode: col(row, "barcode") || null,
            hsn: col(row, "hsn") || null,
            unit: col(row, "unit") || "PCS",
            size: col(row, "size") || null,
            color: col(row, "color") || null,
            purchasePrice: n("purchase_price"),
            sellingPrice: n("selling_price"),
            mrp: n("mrp"),
            gstRate: n("gst_rate", 18),
            minStock: n("min_stock", 5),
            warrantyMonths: Math.round(n("warranty_months")),
            location: col(row, "location") || null,
          };
          const skuIn = col(row, "sku");
          const existing = skuIn ? await tx.product.findUnique({ where: { sku: skuIn } }) : null;
          if (existing) {
            await tx.product.update({ where: { id: existing.id }, data });
            updated++;
          } else {
            const sku = skuIn || (await nextNumber(tx, "sku", "KPR", 4));
            const p = await tx.product.create({ data: { ...data, sku } });
            const st = n("stock");
            if (st > 0) await moveStock(tx, { productId: p.id, qty: st, type: "OPENING", note: "Imported opening stock", userId: s.uid });
            created++;
          }
        });
      } catch (e) {
        errors.push(`Row ${r + 1} (${name}): ${errMsg(e)}`);
      }
    }
    await audit(s.uid, "PRODUCTS_IMPORTED", "Product", null, `${created} created, ${updated} updated`);
    revalidatePath("/products");
    const msg = `${created} products created, ${updated} updated.`;
    if (errors.length) return { error: `${msg} ${errors.length} rows failed: ${errors.slice(0, 5).join(" | ")}` };
    return { ok: msg };
  } catch (e) {
    return { error: errMsg(e) };
  }
}
