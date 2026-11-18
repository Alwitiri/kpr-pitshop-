import { requirePage } from "@/lib/auth";
import { PageHeader } from "@/components/ui";
import { CustomerForm } from "@/components/customer-form";

export const metadata = { title: "New customer" };

export default async function NewCustomerPage() {
  await requirePage("customers");
  return (
    <>
      <PageHeader title="New customer" back="/customers" />
      <div className="card card-pad max-w-3xl"><CustomerForm /></div>
    </>
  );
}
