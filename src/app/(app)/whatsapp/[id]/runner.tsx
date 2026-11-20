"use client";

import Link from "next/link";
import { useState, useTransition } from "react";
import { sendCampaignRecipient, setRecipientStatus, type WaOpen } from "@/actions/whatsapp";
import { openWhatsApp, WaGlyph, WaResultPanel } from "@/components/whatsapp-button";

type R = { id: number; name: string; phone: string; status: string; customerId: number | null };

const STATUS: Record<string, [string, string]> = {
  PENDING: ["Not sent", "bg-gray-100 text-gray-600"],
  SENT: ["Opened", "bg-emerald-50 text-emerald-700"],
  SKIPPED: ["Skipped", "bg-amber-50 text-amber-700"],
  OPTED_OUT: ["Opted out", "bg-red-50 text-red-700"],
};

export function CampaignRunner({ recipients }: { recipients: R[] }) {
  // Local copy so the list updates instantly; the server keeps the real status.
  const [rows, setRows] = useState(recipients);
  const [res, setRes] = useState<{ id: number; r: WaOpen } | null>(null);
  const [pending, start] = useTransition();
  const next = rows.find((r) => r.status === "PENDING");
  const done = rows.filter((r) => r.status !== "PENDING").length;
  const sent = rows.filter((r) => r.status === "SENT").length;
  const pct = rows.length ? Math.round((done / rows.length) * 100) : 0;

  const [offlineFor, setOfflineFor] = useState<R | null>(null);
  const send = (r: R, force = false) =>
    start(async () => {
      const out = await sendCampaignRecipient(r.id, force);
      if (out.offline) {
        setOfflineFor(r);
        setRes(null);
        return;
      }
      setOfflineFor(null);
      setRes({ id: r.id, r: out });
      if (out.ok) {
        setRows((list) => list.map((x) => (x.id === r.id ? { ...x, status: "SENT" } : x)));
        openWhatsApp(out.ok.url);
      }
    });
  const mark = (r: R, status: "PENDING" | "SKIPPED" | "OPTED_OUT") => {
    if (status === "OPTED_OUT" && !window.confirm(`Remove ${r.name}'s consent for WhatsApp offers?`)) return;
    setRows((list) => list.map((x) => (x.id === r.id ? { ...x, status } : x)));
    start(() => setRecipientStatus(r.id, status));
  };

  return (
    <div className="space-y-5">
      <div className="card p-4 sm:p-5">
        <div className="flex flex-wrap items-end justify-between gap-3">
          <div>
            <div className="text-xs font-semibold uppercase tracking-wide text-gray-600">Progress</div>
            <div className="mt-1 text-2xl font-bold tabular-nums">{sent} <span className="text-base font-medium text-gray-500">of {rows.length} opened</span></div>
          </div>
          {next ? (
            <div className="relative">
              <button className="btn-primary min-h-11 bg-[#0a7d4f] px-5 text-base shadow-none hover:bg-[#086a43]" onClick={() => send(next)} disabled={pending} autoFocus>
                <WaGlyph className="h-5 w-5" />
                {pending ? "Opening…" : `Send next: ${next.name}`}
              </button>
            </div>
          ) : (
            <div className="rounded-lg bg-emerald-50 px-3 py-2 text-sm font-semibold text-emerald-800">All done – everyone on the list has been handled.</div>
          )}
        </div>
        <div className="mt-3 h-2 overflow-hidden rounded-full bg-gray-100" role="progressbar" aria-valuenow={pct} aria-valuemin={0} aria-valuemax={100}>
          <div className="h-full rounded-full bg-emerald-500 transition-all duration-300" style={{ width: `${pct}%` }} />
        </div>
        {offlineFor && (
          <div role="alert" className="page-enter mt-3 rounded-lg border border-amber-200 bg-amber-50 p-3 text-sm text-amber-900">
            <b>No internet on the shop PC.</b> Offers are paused so nobody is marked as sent by mistake. The list is kept – carry on when the internet is back.
            <div className="mt-2 flex flex-wrap gap-2">
              <button className="btn-outline btn-sm" onClick={() => send(offlineFor)} disabled={pending}>Try again</button>
              <button className="btn-ghost btn-sm" onClick={() => send(offlineFor, true)} disabled={pending}>Open anyway (this device has internet)</button>
            </div>
          </div>
        )}
        {res && <WaResultPanel res={res.r} onClose={() => setRes(null)} />}
      </div>

      <div className="card overflow-hidden">
        <ul className="divide-y divide-gray-100">
          {rows.map((r) => {
            const [label, cls] = STATUS[r.status] ?? STATUS.PENDING;
            return (
              <li key={r.id} className={`flex flex-wrap items-center gap-3 px-4 py-2.5 sm:px-5 ${r.id === next?.id ? "bg-emerald-50/40" : ""}`}>
                <div className="min-w-0 flex-1">
                  {r.customerId ? <Link className="link" href={`/customers/${r.customerId}`}>{r.name}</Link> : <span className="font-medium">{r.name}</span>}
                  <div className="text-xs text-gray-500">+{r.phone}</div>
                </div>
                <span className={`badge ${cls}`}>{label}</span>
                <div className="flex gap-1.5">
                  {r.status !== "OPTED_OUT" && (
                    <button className="btn-outline btn-sm text-[#0a7d4f]" onClick={() => send(r)} disabled={pending} aria-label={`Open WhatsApp for ${r.name}`}>
                      <WaGlyph className="h-3.5 w-3.5" />{r.status === "SENT" ? "Again" : "Open"}
                    </button>
                  )}
                  {r.status === "PENDING" && <button className="btn-ghost btn-sm" onClick={() => mark(r, "SKIPPED")}>Skip</button>}
                  {(r.status === "SKIPPED" || r.status === "SENT") && <button className="btn-ghost btn-sm" onClick={() => mark(r, "PENDING")}>Undo</button>}
                  {r.status !== "OPTED_OUT" && <button className="btn-ghost btn-sm text-red-600" onClick={() => mark(r, "OPTED_OUT")}>Opted out</button>}
                </div>
              </li>
            );
          })}
        </ul>
      </div>
    </div>
  );
}
