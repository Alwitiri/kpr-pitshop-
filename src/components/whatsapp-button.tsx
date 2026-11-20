"use client";

import { useState, useTransition } from "react";
import { openQueued, prepareWhatsApp, type WaOpen } from "@/actions/whatsapp";
import { refreshInternet } from "./internet-status";
import { WA_KINDS, type WaKind } from "@/lib/wa-templates";

export function WaGlyph({ className = "h-4 w-4" }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" className={`shrink-0 ${className}`} fill="currentColor" aria-hidden>
      <path d="M17.5 14.4c-.3-.1-1.8-.9-2-1-.3-.1-.5-.1-.7.1-.2.3-.8 1-.9 1.2-.2.2-.3.2-.6.1a8.2 8.2 0 0 1-4-3.5c-.3-.5.3-.5.9-1.6.1-.2 0-.4 0-.5l-.9-2.2c-.2-.6-.5-.5-.7-.5h-.6a1.2 1.2 0 0 0-.9.4 3.6 3.6 0 0 0-1.1 2.7 6.3 6.3 0 0 0 1.3 3.3 14.4 14.4 0 0 0 5.5 4.9c2 .9 2.8.9 3.8.8a3.2 3.2 0 0 0 2.1-1.5 2.6 2.6 0 0 0 .2-1.5c-.1-.1-.3-.2-.6-.3M12 21.8a9.8 9.8 0 0 1-5-1.4l-.4-.2-3.7 1 1-3.6-.2-.4A9.8 9.8 0 1 1 12 21.8M20.5 3.5A11.8 11.8 0 0 0 1.9 17.7L.2 24l6.4-1.7A11.8 11.8 0 0 0 24 12a11.7 11.7 0 0 0-3.5-8.5" />
    </svg>
  );
}

/** Opens WhatsApp with the result of prepareWhatsApp / sendCampaignRecipient. Returns false if nothing could open. */
export function openWhatsApp(url: string) {
  if (url.startsWith("whatsapp:")) {
    window.location.href = url; // WhatsApp Desktop / phone app
    return true;
  }
  return !!window.open(url, "_blank", "noopener");
}

/** Small panel shown after a click: fallbacks if WhatsApp did not open, or a box for the mobile number. */
export function WaResultPanel({
  res,
  onPhone,
  onClose,
  pending,
}: {
  res: WaOpen;
  onPhone?: (phone: string) => void;
  onClose: () => void;
  pending?: boolean;
}) {
  const [phone, setPhone] = useState("");
  const [copied, setCopied] = useState(false);
  const [opening, startOpen] = useTransition();
  const [late, setLate] = useState<WaOpen | null>(null);
  if (late) res = late;
  return (
    <div role="status" className="page-enter mt-2 w-[min(88vw,340px)] rounded-lg border border-gray-200 bg-white p-3 text-left text-xs text-gray-700 shadow-lg">
      {res.sent && (
        <div className="flex items-start gap-1.5 font-semibold text-emerald-700">
          <svg viewBox="0 0 24 24" className="mt-px h-4 w-4 shrink-0" fill="none" stroke="currentColor" strokeWidth={2.5} strokeLinecap="round" strokeLinejoin="round" aria-hidden><path d="M20 6 9 17l-5-5" /></svg>
          <span>Sent automatically on WhatsApp to +{res.sent.phone}</span>
        </div>
      )}
      {res.cloudQueued && (
        <>
          <div className="mb-1 font-semibold text-amber-700">{res.error ? "WhatsApp is busy – will retry" : "No internet – will send by itself"}</div>
          <p className="text-gray-600">
            {res.error ?? "The message is saved and goes out automatically as soon as the internet is back."} See <a className="link" href="/whatsapp#automatic">WhatsApp → Automatic</a>.
          </p>
        </>
      )}
      {res.fallback && (
        <div className="mt-2 flex flex-wrap gap-1.5">
          <button type="button" className="btn-outline btn-sm" onClick={() => openWhatsApp(res.fallback!.url)}>
            <WaGlyph className="h-3.5 w-3.5" />Open in WhatsApp instead
          </button>
          <a className="btn-ghost btn-sm" href={res.fallback.webUrl} target="_blank" rel="noopener">WhatsApp Web</a>
        </div>
      )}
      {res.queued && !res.ok && (
        <>
          <div className="mb-1 font-semibold text-amber-700">No internet right now – message saved</div>
          <p className="mb-2 text-gray-600">
            It waits in <a className="link" href="/whatsapp#waiting">WhatsApp → Waiting</a>. When the internet is back, open it from there with one click. The rest of the software keeps working.
          </p>
          <button
            type="button"
            className="btn-outline btn-sm"
            disabled={opening}
            onClick={() =>
              startOpen(async () => {
                const r = await openQueued(res.queued!);
                setLate(r);
                if (r.ok) openWhatsApp(r.ok.url);
                refreshInternet(true);
              })
            }
          >
            Open anyway (this device has internet)
          </button>
        </>
      )}
      {res.ok && (
        <>
          <div className="mb-2 flex items-center gap-1.5 font-semibold text-emerald-700"><WaGlyph className="h-3.5 w-3.5" />Opening WhatsApp for +{res.ok.phone}</div>
          <p className="mb-2 text-gray-600">Check the message and press <b>Send</b> in WhatsApp.</p>
          <div className="flex flex-wrap gap-1.5">
            <a className="btn-outline btn-sm" href={res.ok.webUrl} target="_blank" rel="noopener">Didn&apos;t open? Use WhatsApp Web</a>
            <button
              type="button"
              className="btn-ghost btn-sm"
              onClick={async () => {
                try {
                  await navigator.clipboard.writeText(res.ok!.text);
                  setCopied(true);
                } catch {
                  /* clipboard blocked */
                }
              }}
            >
              {copied ? "Copied" : "Copy message"}
            </button>
          </div>
        </>
      )}
      {res.needPhone && onPhone && (
        <form
          onSubmit={(e) => {
            e.preventDefault();
            onPhone(phone);
          }}
          className="space-y-2"
        >
          <label className="block">
            <span className="label">Customer&apos;s WhatsApp number</span>
            <input className="input" inputMode="tel" autoFocus value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="98765 43210" required />
          </label>
          {res.error && <p className="text-red-700">{res.error}</p>}
          <button className="btn-primary btn-sm w-full" disabled={pending}>Open WhatsApp</button>
        </form>
      )}
      {res.error && !res.needPhone && !res.cloudQueued && <p className="mt-1 text-red-700">{res.error}</p>}
      <button type="button" onClick={onClose} className="mt-2 text-gray-500 hover:text-gray-800">Close</button>
    </div>
  );
}

type Target = { customerId?: number | null; saleId?: number | null; jobCardId?: number | null; followUpId?: number | null };

/** "Send on WhatsApp" for one message kind. */
export function WhatsAppButton({
  kind,
  label = "WhatsApp",
  className = "btn-outline",
  ...target
}: Target & { kind: WaKind; label?: string; className?: string }) {
  const [res, setRes] = useState<WaOpen | null>(null);
  const [pending, start] = useTransition();
  const run = (phone?: string) =>
    start(async () => {
      const r = await prepareWhatsApp({ kind, ...target, phone: phone ?? null });
      setRes(r);
      if (r.ok) openWhatsApp(r.ok.url);
      if (r.queued) refreshInternet(true);
    });
  return (
    <div className="relative inline-block">
      <button type="button" className={`${className} text-[#0a7d4f]`} onClick={() => run()} disabled={pending} aria-busy={pending || undefined}>
        <WaGlyph />
        {pending ? "Opening…" : label}
      </button>
      {res && (
        <div className="absolute right-0 z-30 sm:right-auto sm:left-0">
          <WaResultPanel res={res} pending={pending} onPhone={(p) => run(p)} onClose={() => setRes(null)} />
        </div>
      )}
    </div>
  );
}

/** Pick any message type for a customer, then open WhatsApp. */
export function WhatsAppMenu({ customerId, kinds }: { customerId: number; kinds?: WaKind[] }) {
  const list = WA_KINDS.filter((k) => k.key !== "INVOICE" && k.key !== "OFFER" && (!kinds || kinds.includes(k.key)));
  const [kind, setKind] = useState<WaKind>(list[0].key);
  const [res, setRes] = useState<WaOpen | null>(null);
  const [pending, start] = useTransition();
  return (
    <div>
      <div className="flex gap-2">
        <select className="input" value={kind} onChange={(e) => setKind(e.target.value as WaKind)} aria-label="Message">
          {list.map((k) => <option key={k.key} value={k.key}>{k.label}</option>)}
        </select>
        <button
          type="button"
          className="btn-primary bg-[#0a7d4f] shadow-none hover:bg-[#086a43]"
          disabled={pending}
          onClick={() =>
            start(async () => {
              const r = await prepareWhatsApp({ kind, customerId });
              setRes(r);
              if (r.ok) openWhatsApp(r.ok.url);
              if (r.queued) refreshInternet(true);
            })
          }
        >
          <WaGlyph />
          {pending ? "Opening…" : "Send"}
        </button>
      </div>
      {res && <WaResultPanel res={res} onClose={() => setRes(null)} onPhone={(p) => start(async () => {
        const r = await prepareWhatsApp({ kind, customerId, phone: p });
        setRes(r);
        if (r.ok) openWhatsApp(r.ok.url);
      })} pending={pending} />}
    </div>
  );
}
