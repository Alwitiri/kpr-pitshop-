import { requirePage } from "@/lib/auth";
import { PageHeader } from "@/components/ui";
import { SupplierForm } from "@/components/supplier-form";

export const metadata = { title: "New supplier" };

export default async function NewSupplierPage() {
  await requirePage("suppliers");
  return (
    <>
      <PageHeader title="New supplier" back="/suppliers" />
      <div className="card card-pad max-w-3xl"><SupplierForm /></div>
    </>
  );
}
