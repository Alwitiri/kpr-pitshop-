import { redirect } from "next/navigation";
import { requirePage } from "@/lib/auth";
import { can } from "@/lib/roles";
import { PageHeader, Section } from "@/components/ui";
import { ActionForm, ExportCsv, Submit } from "@/components/forms";
import { importCustomers } from "@/actions/customers";

export const metadata = { title: "Import customers" };

const TEMPLATE = [
  ["name", "phone", "alt_phone", "email", "address", "gstin", "birthday", "tags", "notes", "opening_balance", "whatsapp_opt_in", "vehicle_type", "vehicle_make", "vehicle_model", "vehicle_reg_no", "vehicle_year"],
  ["Arun Kumar", "9876543210", "", "arun@example.com", "Gandhipuram, Coimbatore", "", "25/08/1992", "rider-club", "Prefers Steelbird", "1500", "yes", "BIKE", "Royal Enfield", "Classic 350", "TN37AB1234", "2021"],
  ["Arun Kumar", "9876543210", "", "", "", "", "", "", "", "", "", "CAR", "Maruti", "Swift", "TN37CD5678", "2019"],
];

export default async function ImportCustomersPage() {
  const s = await requirePage("customers");
  if (!can(s.role, "importData")) redirect("/customers");
  return (
    <>
      <PageHeader title="Import customers from Excel" subtitle="Move customer records from an old system, a notebook or other software" back="/customers" />
      <div className="grid gap-5 lg:grid-cols-2">
        <Section title="1. Prepare the sheet">
          <ol className="list-decimal space-y-2 pl-5 text-sm text-gray-700">
            <li>Download the template and open it in Excel.</li>
            <li>One row per customer. Only <b>name</b> is required.</li>
            <li>The <b>mobile number</b> is used to match: if it already exists, that customer is updated, and blank cells never erase saved details.</li>
            <li>Customer with two vehicles? Repeat the row with the same mobile and the second vehicle.</li>
            <li><b>birthday</b> can be 25/08/1992, 25/08 or 25 Aug. <b>opening_balance</b> is the amount the customer already owes.</li>
            <li>Put <b>yes</b> in <b>whatsapp_opt_in</b> only for customers who agreed to receive messages.</li>
            <li>In Excel choose <b>File → Save As → CSV UTF-8</b>.</li>
          </ol>
          <div className="mt-4">
            <ExportCsv rows={TEMPLATE} filename="kpr-customer-template.csv" label="Download template" />
          </div>
        </Section>
        <Section title="2. Upload">
          <ActionForm action={importCustomers} className="space-y-4">
            <input type="file" name="file" accept=".csv,text/csv" className="input py-1.5" required />
            <Submit>Import customers</Submit>
          </ActionForm>
          <p className="mt-3 text-xs text-gray-500">Tip: take a backup first (Settings → Back up now) before a big import.</p>
        </Section>
      </div>
    </>
  );
}
