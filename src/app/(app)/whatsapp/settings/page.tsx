import { db } from "@/lib/db";
import { requirePage } from "@/lib/auth";
import { getSettings } from "@/lib/server-utils";
import { WA_DEFAULTS, WA_KINDS, WA_PLACEHOLDERS } from "@/lib/wa-templates";
import { PageHeader, Section } from "@/components/ui";
import { ActionForm, Submit } from "@/components/forms";
import { saveWaSettings } from "@/actions/whatsapp";
import { TemplateField } from "./template-field";

export const metadata = { title: "WhatsApp settings" };

const MODES: [string, string, string][] = [
  ["APP", "WhatsApp Desktop app", "Best on the shop PC: install WhatsApp from the Microsoft Store and link it to the shop's phone once. The first time, the window asks “Open WhatsApp?” – tick “Always allow”. On phones it opens the WhatsApp app."],
  ["WEB", "WhatsApp Web (browser)", "Opens web.whatsapp.com in a new tab. Use this if the Desktop app is not installed."],
  ["LINK", "wa.me link", "Lets WhatsApp choose the app or web page. Slower, but works everywhere."],
];

export default async function WhatsAppSettingsPage() {
  await requirePage("whatsapp");
  const [s, saved] = await Promise.all([getSettings(), db.waTemplate.findMany()]);
  const savedMap = new Map(saved.map((t) => [t.key, t.body]));

  return (
    <>
      <PageHeader title="WhatsApp settings" subtitle="How WhatsApp opens, and the wording of every message" back="/whatsapp" />
      <ActionForm action={saveWaSettings} className="grid gap-5 xl:grid-cols-[1fr_360px]">
        <div className="space-y-5">
          <Section title="Message wording">
            <div className="space-y-6">
              {WA_KINDS.map((k) => (
                <TemplateField key={k.key} name={`t_${k.key}`} label={k.label} hint={k.hint} value={savedMap.get(k.key) ?? WA_DEFAULTS[k.key]} defaultValue={WA_DEFAULTS[k.key]} />
              ))}
            </div>
          </Section>
        </div>
        <div className="space-y-5 xl:sticky xl:top-5 xl:self-start">
          <Section title="Open messages in">
            <div className="space-y-2">
              {MODES.map(([v, l, d]) => (
                <label key={v} className="flex cursor-pointer items-start gap-3 rounded-lg border border-gray-200 p-3 has-[:checked]:border-emerald-500 has-[:checked]:bg-emerald-50/50">
                  <input type="radio" name="waOpenWith" value={v} defaultChecked={s.waOpenWith === v} className="mt-0.5 h-4 w-4" />
                  <span><span className="block text-sm font-semibold">{l}</span><span className="block text-xs text-gray-600">{d}</span></span>
                </label>
              ))}
            </div>
            <label className="mt-3 block">
              <span className="label">Country code for 10-digit numbers</span>
              <input name="waCountryCode" className="input w-28" defaultValue={s.waCountryCode} inputMode="numeric" />
            </label>
          </Section>
          <Section title="Placeholders">
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
