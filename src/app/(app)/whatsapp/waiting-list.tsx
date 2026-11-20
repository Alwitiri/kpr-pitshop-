"use client";

import Link from "next/link";
import { useState, useTransition } from "react";
import { openQueued, removeQueued, type WaOpen } from "@/actions/whatsapp";
import { openWhatsApp, WaGlyph, WaResultPanel } from "@/components/whatsapp-button";
import { refreshInternet, useInternet } from "@/components/internet-status";

type Item = { id: number; label: string; customer: { id: number; name: string } | null; phone: string; preview: string; when: string };

/** Messages saved while the internet was down – open them one by one once it is back. */
export function WaitingList({ items }: { items: Item[] }) {
  const [rows, setRows] = useState(items);
  const [res, setRes] = useState<WaOpen | null>(null);
  const [pending, start] = useTransition();
  const net = useInternet();

  const open = (it: Item) =>
    start(async () => {
      const r = await openQueued(it.id);
      setRes(r);
      if (r.ok) openWhatsApp(r.ok.url);
      setRows((l) => l.filter((x) => x.id !== it.id));
      refreshInternet(true);
    });
  const remove = (it: Item) => {
    if (!window.confirm("Remove this waiting message? It will not be sent.")) return;
    setRows((l) => l.filter((x) => x.id !== it.id));
    start(async () => {
      await removeQueued(it.id);
      refreshInternet(true);
    });
  };

  if (!rows.length && !res) return null;
  return (
    <section id="waiting" className="card mb-5 scroll-mt-5 border-amber-200">
      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-amber-100 bg-amber-50/60 px-4 py-3 sm:px-5">
        <div>
          <h2 className="text-[0.95rem] font-semibold text-gray-950">Waiting for internet · {rows.length}</h2>
          <p className="text-xs text-gray-600">
            {net.online === false ? "Still no internet. These will be ready to open as soon as it is back." : "Internet is back – open each one and press Send in WhatsApp."}
          </p>
        </div>
        {rows.length > 0 && (
          <button className="btn-primary bg-[#0a7d4f] shadow-none hover:bg-[#086a43]" onClick={() => open(rows[0])} disabled={pending}>
            <WaGlyph />
            {pending ? "Opening…" : `Open next: ${rows[0].customer?.name ?? "+" + rows[0].phone}`}
          </button>
        )}
      </div>
      {res && <div className="px-4 pt-3 sm:px-5"><WaResultPanel res={res} onClose={() => setRes(null)} /></div>}
      <ul className="divide-y divide-gray-100">
        {rows.map((it) => (
          <li key={it.id} className="flex flex-wrap items-center gap-3 px-4 py-2.5 sm:px-5">
            <div className="min-w-0 flex-1">
              <div className="text-sm">
                {it.customer ? <Link className="link" href={`/customers/${it.customer.id}`}>{it.customer.name}</Link> : <span className="font-medium">+{it.phone}</span>}
                <span className="ml-1.5 text-xs text-gray-500">{it.label} · saved {it.when}</span>
              </div>
              <div className="truncate text-xs text-gray-500" title={it.preview}>{it.preview}</div>
            </div>
            <div className="flex gap-1.5">
              <button className="btn-outline btn-sm text-[#0a7d4f]" onClick={() => open(it)} disabled={pending}><WaGlyph className="h-3.5 w-3.5" />Open</button>
              <button className="btn-ghost btn-sm text-red-600" onClick={() => remove(it)} disabled={pending}>Remove</button>
            </div>
          </li>
        ))}
      </ul>
    </section>
  );
}
