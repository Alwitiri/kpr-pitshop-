import { db } from "@/lib/db";
import { requirePage } from "@/lib/auth";
import { getSettings } from "@/lib/server-utils";
import { PageHeader } from "@/components/ui";
import { ProductForm } from "@/components/product-form";

export const metadata = { title: "New product" };

export default async function NewProductPage() {
  await requirePage("products");
  const [categories, brands, suppliers, settings] = await Promise.all([
    db.category.findMany({ orderBy: { name: "asc" }, select: { id: true, name: true } }),
    db.brand.findMany({ orderBy: { name: "asc" }, select: { id: true, name: true } }),
    db.supplier.findMany({ where: { active: true }, orderBy: { name: "asc" }, select: { id: true, name: true } }),
    getSettings(),
  ]);
  return (
    <>
      <PageHeader title="New product" back="/products" />
      <ProductForm categories={categories} brands={brands} suppliers={suppliers} defaultMinStock={settings.defaultMinStock} />
    </>
  );
}
