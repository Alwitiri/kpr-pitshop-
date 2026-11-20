import { db } from "@/lib/db";
import { requirePage } from "@/lib/auth";
import { getSettings } from "@/lib/server-utils";
import { cloudConfig } from "@/lib/wa-cloud";
import { WA_DEFAULTS, WA_KINDS, WA_PLACEHOLDERS } from "@/lib/wa-templates";
import { PageHeader, Section } from "@/components/ui";
import { ActionForm, Submit } from "@/components/forms";
import { saveWaSettings } from "@/actions/whatsapp";
import { TemplateField } from "./template-field";
import { CloudTools, ModeChoice } from "./cloud-tools";

export const metadata = { title: "WhatsApp settings" };

const MODES: [string, string, string][] = [
  ["APP", "WhatsApp Desktop app", "Best on the shop PC: install WhatsApp from the Microsoft Store and link it to the shop's phone once. The first time, the window asks “Open WhatsApp?” – tick “Always allow”. On phones it opens the WhatsApp app."],
  ["WEB", "WhatsApp Web (browser)", "Opens web.whatsapp.com in a new tab. Use this if the Desktop app is not installed."],
  ["LINK", "wa.me link", "Lets WhatsApp choose the app or web page. Slower, but works everywhere."],
];

// Sensible fill-ins for each message when an approved template is chosen
const SUGGESTED: Record<string, string> = {
  INVOICE: "customer,invoice,total",
  PAYMENT_DUE: "customer,due",
  VEHICLE_READY: "customer,vehicle,job",
  SERVICE_DUE: "customer,vehicle",
  WARRANTY: "customer,item",
  BIRTHDAY: "customer",
  FEEDBACK: "customer,invoice",
  WIN_BACK: "customer,vehicle",
  GENERAL: "customer",
  OFFER: "customer",
};

export default async function WhatsAppSettingsPage() {
  const session = await requirePage("whatsapp");
  const isOwner = session.role === "OWNER";
  const [s, saved, cloud] = await Promise.all([getSettings(), db.waTemplate.findMany(), cloudConfig()]);
  const savedMap = new Map(saved.map((t) => [t.key, t]));
  const approved = cloud.templates.filter((t) => t.status === "APPROVED");
  const mockMode = process.env.KPR_WA_CLOUD_MOCK === "1";

  return (
    <>
      <PageHeader title="WhatsApp settings" subtitle="How messages are sent, and the wording of every message" back="/whatsapp" />
      <ActionForm action={saveWaSettings} className="grid gap-5 xl:grid-cols-[1fr_380px]">
        <div className="space-y-5">
          <Section title="Sending method">
            <ModeChoice defaultMode={s.waMode} />
            <div className="mt-4 rounded-lg border border-gray-200 p-3" data-cloud-only>
              <label className="flex items-start gap-3 text-sm">
                <input type="checkbox" name="waAutoInvoice" defaultChecked={s.waAutoInvoice} className="mt-0.5 h-4 w-4" />
                <span>
                  <b>Send the bill automatically after every sale</b>
                  <span className="block text-xs text-gray-600">When the customer (or the walk-in bill) has a mobile number. Needs automatic mode.</span>
                </span>
              </label>
              <p className="mt-2 text-xs text-gray-600">
                Reminders: tick <b>Send WhatsApp automatically</b> on any rule in <a className="link" href="/settings/workflows">Settings → Workflows</a>. Offers: use <b>Send all automatically</b> on an offer list.
              </p>
            </div>
          </Section>

          <Section title="Message wording">
            <p className="mb-4 text-xs text-gray-600">
              In <b>click to send</b> mode the wording below is used as it is. In <b>automatic</b> mode WhatsApp only lets a business start a chat with a <b>template approved by Meta</b>: choose the template for each message and which details fill its <code className="kbd">{"{{1}}"}</code>, <code className="kbd">{"{{2}}"}</code>… in order. Without a template, the wording is sent as plain text, which WhatsApp only delivers if the customer messaged the shop in the last 24 hours.
            </p>
            <div className="space-y-6">
              {WA_KINDS.map((k) => {
                const row = savedMap.get(k.key);
                return (
                  <TemplateField
                    key={k.key}
                    kind={k.key}
                    label={k.label}
                    hint={k.hint}
                    value={row?.body ?? WA_DEFAULTS[k.key]}
                    defaultValue={WA_DEFAULTS[k.key]}
                    cloud={{
                      template: row?.cloudTemplate ?? "",
                      lang: row?.cloudLang ?? "",
                      params: row?.cloudParams ?? "",
                      suggested: SUGGESTED[k.key],
                      options: approved.map((t) => ({ name: t.name, language: t.language, params: t.params, category: t.category, body: t.body })),
                    }}
                  />
                );
              })}
            </div>
          </Section>
        </div>

        <div className="space-y-5 xl:sticky xl:top-5 xl:self-start">
          <Section title="Automatic sending – WhatsApp Cloud API">
            {isOwner ? (
              <div className="space-y-3">
                <p className="text-xs text-gray-600">
                  From the shop&apos;s <b>Meta Business</b> account (developers.facebook.com → your app → WhatsApp → API setup). Use a <b>permanent</b> token from a System User. Meta charges per message.
                </p>
                <label className="block"><span className="label">Phone number ID</span><input name="waCloudPhoneId" className="input font-mono" defaultValue={s.waCloudPhoneId ?? ""} inputMode="numeric" autoComplete="off" /></label>
                <label className="block"><span className="label">WhatsApp Business Account ID</span><input name="waCloudWabaId" className="input font-mono" defaultValue={s.waCloudWabaId ?? ""} inputMode="numeric" autoComplete="off" /></label>
                <label className="block">
                  <span className="label">Access token</span>
                  <input name="waCloudToken" type="password" className="input font-mono" autoComplete="new-password" placeholder={s.waCloudToken ? `Saved (ends …${s.waCloudToken.slice(-4)}) – leave empty to keep` : "Paste the permanent token"} />
                  {s.waCloudToken && (
                    <span className="mt-1 flex items-center gap-2 text-xs text-gray-600"><input type="checkbox" name="waCloudTokenClear" className="h-3.5 w-3.5" /> Remove the saved token</span>
                  )}
                </label>
                <label className="block"><span className="label">Graph API version</span><input name="waCloudVersion" className="input w-28 font-mono" defaultValue={s.waCloudVersion} /></label>
                <p className="text-xs text-gray-500">The token is kept only in this shop&apos;s database (and its backups) and is never shown again.</p>
              </div>
            ) : (
              <p className="text-sm text-gray-600">Only the owner can enter or change the Meta account details.</p>
            )}
            <CloudTools ready={cloud.ready} templateCount={cloud.templates.length} approvedCount={approved.length} mock={mockMode} />
          </Section>

          <Section title="Click to send – open messages in">
            <div className="space-y-2">
              {MODES.map(([v, l, d]) => (
                <label key={v} className="flex cursor-pointer items-start gap-3 rounded-lg border border-gray-200 p-3 has-[:checked]:border-emerald-500 has-[:checked]:bg-emerald-50/50">
                  <input type="radio" name="waOpenWith" value={v} defaultChecked={s.waOpenWith === v} className="mt-0.5 h-4 w-4" />
                  <span><span className="block text-sm font-semibold">{l}</span><span className="block text-xs text-gray-600">{d}</span></span>
                </label>
              ))}
            </div>
            <p className="mt-2 text-xs text-gray-500">Also used in automatic mode for “Open in WhatsApp instead”.</p>
            <label className="mt-3 block">
              <span className="label">Country code for 10-digit numbers</span>
              <input name="waCountryCode" className="input w-28" defaultValue={s.waCountryCode} inputMode="numeric" />
            </label>
          </Section>

          <Section title="Placeholders / fill-ins">
            <ul className="space-y-1 text-xs text-gray-600">
              {WA_PLACEHOLDERS.map(([k, d]) => <li key={k}><code className="kbd">{k}</code> {d}</li>)}
            </ul>
            <p className="mt-2 text-xs text-gray-500">Put *stars* around words to make them bold in WhatsApp.</p>
          </Section>
          <Submit className="btn-primary w-full">Save WhatsApp settings</Submit>
        </div>
      </ActionForm>
    </>
  );
}
