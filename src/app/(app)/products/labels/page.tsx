import { db } from "@/lib/db";
import { requirePage } from "@/lib/auth";
import { getSettings } from "@/lib/server-utils";
import { PageHeader } from "@/components/ui";
import { LabelPrinter } from "./label-printer";

export const metadata = { title: "Barcode stickers" };

/**
 * /products/labels?ids=1,2&qty=5,3   – specific products and how many stickers of each
 * /products/labels?purchase=7        – everything received on purchase PO #7 (qty = received)
 */
export default async function LabelsPage({ searchParams }: { searchParams: Promise<{ ids?: string; qty?: string; purchase?: string }> }) {
  await requirePage("products");
  const sp = await searchParams;
  const initial: Record<number, number> = {};
  const ids = (sp.ids ?? "").split(",").map(Number).filter(Boolean);
  const qtys = (sp.qty ?? "").split(",").map(Number);
  ids.forEach((id, i) => (initial[id] = Math.max(1, Math.round(qtys[i] || 1))));
  let note = "";
  if (sp.purchase) {
    const pur = await db.purchase.findUnique({ where: { id: Number(sp.purchase) }, include: { items: true } });
    if (pur) {
      for (const it of pur.items) initial[it.productId] = (initial[it.productId] ?? 0) + Math.round(it.qty);
      note = `Stickers for everything received on purchase ${pur.number}.`;
    }
  }
  const [products, settings, missing] = await Promise.all([
    db.product.findMany({
      where: { active: true },
      select: { id: true, name: true, sku: true, barcode: true, sellingPrice: true, mrp: true, size: true, color: true, stock: true },
      orderBy: { name: "asc" },
    }),
    getSettings(),
    db.product.count({ where: { active: true, OR: [{ barcode: null }, { barcode: "" }] } }),
  ]);
  return (
    <>
      <div className="no-print">
        <PageHeader
          title="Print barcode stickers"
          subtitle={note || "Choose products and how many stickers, pick your sticker type, then print. Stick one on each piece."}
          back="/products"
        />
      </div>
      <LabelPrinter products={products} initial={initial} shopName={settings.shopName} missingBarcodes={missing} />
    </>
  );
}
