"use server";

import { db } from "@/lib/db";
import { requireAction } from "@/lib/auth";
import { cleanCode } from "@/lib/barcode";

export type ScanResult =
  | { type: "product"; id: number; name: string; sellingPrice: number; mrp: number; stock: number; barcode: string | null; sku: string; location: string | null }
  | { type: "sale"; id: number; invoiceNo: string }
  | { type: "none"; code: string };

/** What does a scanned code belong to? Product barcode / SKU, or an invoice number printed on a bill. */
export async function lookupCode(raw: string): Promise<ScanResult> {
  await requireAction();
  const code = cleanCode(raw);
  if (!code) return { type: "none", code };
  const product =
    (await db.product.findUnique({ where: { barcode: code } })) ??
    (await db.product.findUnique({ where: { sku: code } })) ??
    (await db.product.findUnique({ where: { sku: code.toUpperCase() } }));
  if (product) {
    return {
      type: "product", id: product.id, name: product.name, sellingPrice: product.sellingPrice, mrp: product.mrp,
      stock: product.stock, barcode: product.barcode, sku: product.sku, location: product.location,
    };
  }
  const sale = await db.sale.findUnique({ where: { invoiceNo: code.toUpperCase() }, select: { id: true, invoiceNo: true } });
  if (sale) return { type: "sale", ...sale };
  return { type: "none", code };
}
