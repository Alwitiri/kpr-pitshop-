import { requirePage } from "@/lib/auth";
import { getSettings } from "@/lib/server-utils";
import { PageHeader, Section } from "@/components/ui";
import { ActionForm, Submit } from "@/components/forms";
import { saveSettings } from "@/actions/staff";

export const metadata = { title: "Settings" };

export default async function SettingsPage() {
  await requirePage("settings");
  const s = await getSettings();
  return (
    <>
      <PageHeader title="Settings" subtitle="Shop details printed on invoices, and system preferences" />
      <div className="grid gap-5 xl:grid-cols-[1fr_380px]">
        <Section title="Shop & invoice details">
          <ActionForm action={saveSettings} className="space-y-4">
            <div className="grid gap-4 sm:grid-cols-2">
              <label><span className="label">Shop name</span><input name="shopName" className="input" defaultValue={s.shopName} /></label>
              <label><span className="label">Tagline</span><input name="tagline" className="input" defaultValue={s.tagline ?? ""} /></label>
              <label className="sm:col-span-2"><span className="label">Address</span><textarea name="address" rows={2} className="input" defaultValue={s.address ?? ""} /></label>
              <label><span className="label">Phone</span><input name="phone" className="input" defaultValue={s.phone ?? ""} /></label>
              <label><span className="label">Email</span><input name="email" className="input" defaultValue={s.email ?? ""} /></label>
              <label><span className="label">GSTIN</span><input name="gstin" className="input uppercase" defaultValue={s.gstin ?? ""} maxLength={15} /></label>
              <div className="grid grid-cols-[1fr_90px] gap-2">
                <label><span className="label">State</span><input name="stateName" className="input" defaultValue={s.stateName} /></label>
                <label><span className="label">Code</span><input name="stateCode" className="input" defaultValue={s.stateCode} /></label>
              </div>
              <label><span className="label">Invoice number prefix</span><input name="invoicePrefix" className="input uppercase" defaultValue={s.invoicePrefix} /></label>
              <label><span className="label">UPI ID (printed on A4 invoice)</span><input name="upiId" className="input" defaultValue={s.upiId ?? ""} /></label>
              <label className="sm:col-span-2"><span className="label">Bank details</span><textarea name="bankDetails" rows={2} className="input" defaultValue={s.bankDetails ?? ""} /></label>
              <label className="sm:col-span-2"><span className="label">Invoice footer / terms</span><textarea name="invoiceFooter" rows={2} className="input" defaultValue={s.invoiceFooter ?? ""} /></label>
              <label><span className="label">Default minimum stock for new products</span><input name="defaultMinStock" type="number" min="0" className="input" defaultValue={s.defaultMinStock} /></label>
              <label><span className="label">Dead stock after (days without sale)</span><input name="deadStockDays" type="number" min="15" className="input" defaultValue={s.deadStockDays} /></label>
            </div>
            <Submit>Save settings</Submit>
          </ActionForm>
        </Section>
        <div className="space-y-5">
          <Section title="Backup">
            <p className="mb-3 text-sm text-gray-600">Download a complete copy of all business data (products, sales, customers, stock history…). Keep it on a pen drive or Google Drive. Do this at least once a week.</p>
            <a href="/api/backup" className="btn-dark w-full">Download full backup</a>
          </Section>
          <Section title="Coming next">
            <p className="text-sm text-gray-600">
              <b>WhatsApp module</b> – one-click offers to opted-in customers, invoice on WhatsApp, payment and warranty reminders. Customer WhatsApp consent is already being recorded at billing so the list is ready when this is switched on.
            </p>
          </Section>
        </div>
      </div>
    </>
  );
}
