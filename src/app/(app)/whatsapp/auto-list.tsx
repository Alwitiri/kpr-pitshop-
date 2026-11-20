"use client";

import Link from "next/link";
import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { cancelCloudMessage, sendCloudNow } from "@/actions/whatsapp";
import { openWhatsApp, WaGlyph } from "@/components/whatsapp-button";

type Item = {
  id: number;
  status: "QUEUED" | "FAILED";
  label: string;
  customer: { id: number; name: string } | null;
  phone: string;
  preview: string;
  when: string; // "sends 22 Nov" / "waiting since…" / "failed …"
  scheduled: boolean;
  error: string | null;
  clickUrl: string;
};

/** Automatic (Cloud API) messages that are scheduled, waiting for internet, or failed. */
export function AutoList({ items, cloudOn, sentToday }: { items: Item[]; cloudOn: boolean; sentToday: number }) {
  const [msg, setMsg] = useState<{ id: number; text: string; ok: boolean } | null>(null);
  const [pending, start] = useTransition();
  const router = useRouter();
  const failed = items.filter((i) => i.status === "FAILED");
  const scheduled = items.filter((i) => i.status === "QUEUED" && i.scheduled);
  const waiting = items.filter((i) => i.status === "QUEUED" && !i.scheduled);

  const act = (id: number, fn: () => Promise<{ ok?: boolean; error?: string } | void>) =>
    start(async () => {
      const r = await fn();
      if (r && "error" in r && r.error) setMsg({ id, text: r.error, ok: false });
      else if (r && r.ok) setMsg({ id, text: "Sent.", ok: true });
      router.refresh();
    });

  return (
    <section id="automatic" className="card mb-5 scroll-mt-5">
      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-gray-100 px-4 py-3 sm:px-5">
        <div>
          <h2 className="text-[0.95rem] font-semibold text-gray-950">Automatic sending {cloudOn ? <span className="badge ml-1 bg-emerald-50 text-emerald-700">On</span> : <span className="badge ml-1 bg-gray-100 text-gray-600">Off</span>}</h2>
          <p className="text-xs text-gray-600">
            {sentToday} sent today · {scheduled.length} scheduled · {waiting.length} waiting · {failed.length} failed
            {!cloudOn && waiting.length + scheduled.length > 0 && " – switch automatic mode back on to send the waiting ones"}
          </p>
        </div>
        <Link href="/whatsapp/settings" className="btn-ghost btn-sm">Settings</Link>
      </div>
      {!items.length ? (
        <p className="px-4 py-4 text-sm text-gray-600 sm:px-5">Nothing waiting. Bills, reminders and offers are sent as soon as they are due.</p>
      ) : (
        <ul className="max-h-[420px] divide-y divide-gray-100 overflow-y-auto">
          {[...failed, ...waiting, ...scheduled].map((it) => (
            <li key={it.id} className="flex flex-wrap items-start gap-3 px-4 py-2.5 sm:px-5">
              <span className={`badge mt-0.5 ${it.status === "FAILED" ? "bg-red-50 text-red-700" : it.scheduled ? "bg-violet-50 text-violet-700" : "bg-amber-50 text-amber-700"}`}>
                {it.status === "FAILED" ? "Failed" : it.scheduled ? "Scheduled" : "Waiting"}
              </span>
              <div className="min-w-0 flex-1">
                <div className="text-sm">
                  {it.customer ? <Link className="link" href={`/customers/${it.customer.id}`}>{it.customer.name}</Link> : <span className="font-medium">+{it.phone}</span>}
                  <span className="ml-1.5 text-xs text-gray-500">{it.label} · {it.when}</span>
                </div>
                <div className="truncate text-xs text-gray-500" title={it.preview}>{it.preview}</div>
                {it.error && <div className="text-xs text-red-700">{it.error}</div>}
                {msg?.id === it.id && <div className={`text-xs ${msg.ok ? "text-emerald-700" : "text-red-700"}`}>{msg.text}</div>}
              </div>
              <div className="flex flex-wrap gap-1.5">
                {cloudOn && (
                  <button className="btn-outline btn-sm" disabled={pending} onClick={() => act(it.id, () => sendCloudNow(it.id))}>
                    {it.status === "FAILED" ? "Retry" : "Send now"}
                  </button>
                )}
                {it.status === "FAILED" && (
                  <button className="btn-outline btn-sm text-[#0a7d4f]" onClick={() => openWhatsApp(it.clickUrl)}>
                    <WaGlyph className="h-3.5 w-3.5" />Open in WhatsApp
                  </button>
                )}
                <button
                  className="btn-ghost btn-sm text-red-600"
                  disabled={pending}
                  onClick={() => {
                    if (window.confirm("Cancel this message? It will not be sent.")) act(it.id, () => cancelCloudMessage(it.id));
                  }}
                >
                  Cancel
                </button>
              </div>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
