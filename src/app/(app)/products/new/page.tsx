import { db } from "@/lib/db";
import { requirePage } from "@/lib/auth";
import { getSettings } from "@/lib/server-utils";
import { PageHeader } from "@/components/ui";
import { ProductForm } from "@/components/product-form";

export const metadata = { title: "New product" };

export default async function NewProductPage({ searchParams }: { searchParams: Promise<{ barcode?: string }> }) {
  await requirePage("products");
  const scanned = (await searchParams).barcode?.trim();
  const [categories, brands, suppliers, settings] = await Promise.all([
    db.category.findMany({ orderBy: { name: "asc" }, select: { id: true, name: true } }),
    db.brand.findMany({ orderBy: { name: "asc" }, select: { id: true, name: true } }),
    db.supplier.findMany({ where: { active: true }, orderBy: { name: "asc" }, select: { id: true, name: true } }),
    getSettings(),
  ]);
  return (
    <>
      <PageHeader
        title="New product"
        subtitle={scanned ? `Scanned barcode ${scanned} is not in the system yet – fill in the details to add it.` : undefined}
        back="/products"
      />
      <ProductForm p={scanned ? { barcode: scanned } : undefined} categories={categories} brands={brands} suppliers={suppliers} defaultMinStock={settings.defaultMinStock} />
    </>
  );
}
