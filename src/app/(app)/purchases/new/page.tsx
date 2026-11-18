import { db } from "@/lib/db";
import { requirePage } from "@/lib/auth";
import { pickerProducts } from "@/lib/queries";
import { PageHeader } from "@/components/ui";
import { PurchaseForm } from "./purchase-form";

export const metadata = { title: "New purchase" };

export default async function NewPurchasePage({ searchParams }: { searchParams: Promise<{ supplier?: string }> }) {
  await requirePage("purchases");
  const supplier = Number((await searchParams).supplier) || undefined;
  const [products, suppliers] = await Promise.all([
    pickerProducts(),
    db.supplier.findMany({ where: { active: true }, orderBy: { name: "asc" }, select: { id: true, name: true } }),
  ]);
  return (
    <>
      <PageHeader title="New purchase (stock in)" subtitle="Stock increases automatically when you save." back="/purchases" />
      <PurchaseForm products={products} suppliers={suppliers} defaultSupplier={supplier} />
    </>
  );
}
