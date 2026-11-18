import { db } from "@/lib/db";
import { requirePage } from "@/lib/auth";
import { PageHeader } from "@/components/ui";
import { LabelPrinter } from "./label-printer";

export const metadata = { title: "Barcode labels" };

export default async function LabelsPage({ searchParams }: { searchParams: Promise<{ ids?: string }> }) {
  await requirePage("products");
  const ids = ((await searchParams).ids ?? "").split(",").map(Number).filter(Boolean);
  const products = await db.product.findMany({
    where: { active: true },
    select: { id: true, name: true, sku: true, barcode: true, sellingPrice: true, mrp: true, size: true, color: true },
    orderBy: { name: "asc" },
  });
  return (
    <>
      <div className="no-print">
        <PageHeader title="Print barcode labels" back="/products" subtitle="Pick products and how many labels of each, then print on your label printer or A4 sticker sheet." />
      </div>
      <LabelPrinter products={products} initial={ids} />
    </>
  );
}
