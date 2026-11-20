"use client";

import { useState, useTransition } from "react";
import { loadCloudTemplates, testCloudConnection } from "@/actions/whatsapp";

/** Sending method radio: free click-to-send, or automatic via the Cloud API. */
export function ModeChoice({ defaultMode }: { defaultMode: string }) {
  const options: [string, string, string][] = [
    ["CLICK", "Click to send – free", "The app writes the message and opens WhatsApp; staff press Send. No Meta account, no charges."],
    ["CLOUD", "Automatic – WhatsApp Cloud API", "Messages are sent by the software itself, also when nobody is at the counter. Needs a Meta Business account and approved templates; Meta charges per message."],
  ];
  return (
    <div className="grid gap-2 sm:grid-cols-2">
      {options.map(([v, l, d]) => (
        <label key={v} className="flex cursor-pointer items-start gap-3 rounded-lg border border-gray-200 p-3 has-[:checked]:border-emerald-500 has-[:checked]:bg-emerald-50/50">
          <input type="radio" name="waMode" value={v} defaultChecked={defaultMode === v} className="mt-0.5 h-4 w-4" />
          <span><span className="block text-sm font-semibold">{l}</span><span className="block text-xs text-gray-600">{d}</span></span>
        </label>
      ))}
    </div>
  );
}

/** "Test connection" and "Load approved templates" (use the details already saved). */
export function CloudTools({ ready, templateCount, approvedCount, mock }: { ready: boolean; templateCount: number; approvedCount: number; mock: boolean }) {
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const [pending, start] = useTransition();
  return (
    <div className="mt-4 border-t border-gray-100 pt-3">
      {mock && <p className="mb-2 rounded-md bg-violet-50 px-2 py-1 text-xs font-medium text-violet-800">Test mode: no real messages are sent (KPR_WA_CLOUD_MOCK).</p>}
      <div className="flex flex-wrap gap-2">
        <button type="button" className="btn-outline btn-sm" disabled={pending || !ready} onClick={() => start(async () => setMsg(await testCloudConnection()))}>
          Test connection
        </button>
        <button type="button" className="btn-outline btn-sm" disabled={pending || !ready} onClick={() => start(async () => setMsg(await loadCloudTemplates()))}>
          Load approved templates
        </button>
      </div>
      {!ready && <p className="mt-2 text-xs text-gray-500">Save the Phone number ID and token first.</p>}
      {ready && !msg && <p className="mt-2 text-xs text-gray-500">{templateCount ? `${approvedCount} approved of ${templateCount} templates loaded.` : "No templates loaded yet."}</p>}
      {msg && (
        <p role="status" className={`mt-2 rounded-md px-2 py-1.5 text-xs ${msg.ok ? "bg-emerald-50 text-emerald-800" : "bg-red-50 text-red-800"}`}>
          {pending ? "Working…" : msg.text}
          {msg.ok && msg.text.includes("templates loaded") && " Reload the page to choose them."}
        </p>
      )}
    </div>
  );
}
