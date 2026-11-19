import { requirePage } from "@/lib/auth";
import { getSettings } from "@/lib/server-utils";
import { PageHeader, Section } from "@/components/ui";
import { ActionForm, Submit } from "@/components/forms";
import { ImageInput } from "@/components/image-input";
import { saveSettings } from "@/actions/staff";
import { makeBackup, restoreBackup } from "@/actions/backup";
import { listBackups } from "@/lib/backup";
import { backupDir, dbFilePath } from "@/lib/paths";
import { fmtDateTime } from "@/lib/format";
import { Toggle } from "@/components/forms";
import { networkInterfaces } from "node:os";
import { BrandMark } from "@/components/brand";
import { uploadLogo, deleteLogo } from "@/actions/branding";

export const metadata = { title: "Settings" };

export default async function SettingsPage() {
  const session = await requirePage("settings");
  const s = await getSettings();
  const logo = s.logoFile ? `/api/logo?v=${encodeURIComponent(s.logoFile)}` : null;
  const isOwner = session.role === "OWNER";
  const backups = isOwner ? await listBackups() : [];
  const port = process.env.PORT ?? "3000";
  const lan = Object.values(networkInterfaces())
    .flat()
    .filter((i) => i && i.family === "IPv4" && !i.internal)
    .map((i) => i!.address);
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
          <Section title="Company logo">
            <div className="flex items-center gap-4">
              <BrandMark logo={logo} name={s.shopName} size={88} className="border" />
              <p className="text-sm text-gray-600">
                {logo ? "Shown on the login screen, the menu and printed bills." : "No logo yet – the shop's initials are shown instead."}
              </p>
            </div>
            <ActionForm action={uploadLogo} resetOnSuccess className="mt-4 space-y-2">
              <ImageInput name="logo" mode="logo" required />
              <p className="text-xs text-gray-500">PNG, JPG or WEBP – big images are resized automatically. A square logo on a white or transparent background looks best.</p>
              <Submit>{logo ? "Replace logo" : "Upload logo"}</Submit>
            </ActionForm>
            {logo && (
              <ActionForm action={deleteLogo} className="mt-2">
                <Submit className="btn-ghost btn-sm text-red-600" confirm="Remove the logo?">Remove logo</Submit>
              </ActionForm>
            )}
          </Section>
          <Section title="Backups">
            <p className="mb-3 text-sm text-gray-600">
              A backup is taken <b>automatically every day</b> (last 30 kept) in <span className="break-all font-mono text-xs">{backupDir()}</span>.
              Copy one to a pen drive every week in case the PC fails.
            </p>
            {isOwner ? (
              <>
                <ActionForm action={makeBackup} className="mb-3"><Submit className="btn-dark w-full">Back up now</Submit></ActionForm>
                <ul className="mb-3 max-h-56 divide-y divide-gray-100 overflow-y-auto rounded-lg border text-xs">
                  {backups.map((b) => (
                    <li key={b.name} className="flex items-center justify-between gap-2 px-2 py-1.5">
                      <span>{fmtDateTime(b.createdAt)} <span className="text-gray-400">· {b.kind} · {(b.size / 1024 / 1024).toFixed(1)} MB</span></span>
                      <a className="link" href={`/api/backup/file?name=${encodeURIComponent(b.name)}`}>Download</a>
                    </li>
                  ))}
                  {!backups.length && <li className="px-2 py-2 text-gray-500">No backups yet – the first automatic one is made shortly after start-up.</li>}
                </ul>
                <Toggle label="Restore from a backup" className="btn-danger w-full">
                  <ActionForm action={restoreBackup} className="space-y-2">
                    <p className="text-xs text-red-700">This replaces ALL current data with the backup. A safety copy of today&apos;s data is saved first.</p>
                    <select name="name" className="input text-xs" defaultValue="">
                      <option value="">— pick a saved backup —</option>
                      {backups.map((b) => <option key={b.name} value={b.name}>{fmtDateTime(b.createdAt)} ({b.kind})</option>)}
                    </select>
                    <p className="text-center text-xs text-gray-500">or upload a .db file from a pen drive</p>
                    <input type="file" name="file" accept=".db" className="input py-1.5 text-xs" />
                    <input name="confirm" className="input" placeholder="Type RESTORE to confirm" />
                    <Submit className="btn-danger w-full">Restore</Submit>
                  </ActionForm>
                </Toggle>
                <a href="/api/backup" className="mt-2 block text-center text-xs text-gray-500 hover:underline">Export everything as JSON (for moving to another system)</a>
              </>
            ) : (
              <p className="text-sm text-gray-500">Only the owner can download or restore backups.</p>
            )}
          </Section>
          <Section title="Use on other devices in the shop">
            <p className="mb-2 text-sm text-gray-600">Phones, tablets or a second counter PC on the <b>same Wi-Fi / network</b> can open this address in their browser (no internet needed):</p>
            <ul className="space-y-1 font-mono text-sm">
              {lan.map((a) => <li key={a}>http://{a}:{port}</li>)}
              {!lan.length && <li className="font-sans text-gray-500">This PC is not connected to a network.</li>}
            </ul>
            <p className="mt-2 text-xs text-gray-500">If it doesn&apos;t open, allow “KPR Pitstop / Node.js” in Windows Firewall on this PC.</p>
          </Section>
          <Section title="Data location">
            <p className="break-all font-mono text-xs text-gray-600">{dbFilePath()}</p>
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
