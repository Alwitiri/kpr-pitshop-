"use client";

import Link from "next/link";
import { useEffect, useSyncExternalStore } from "react";

/**
 * Internet status of the shop PC (checked by the server, so phones on the shop Wi-Fi see the same answer).
 * The software works offline; this only matters for WhatsApp.
 */
type Net = { online: boolean | null; queued: number; checkedAt: number };
let state: Net = { online: null, queued: 0, checkedAt: 0 };
const subs = new Set<() => void>();
const set = (n: Net) => {
  state = n;
  subs.forEach((f) => f());
};

let inflight: Promise<void> | null = null;
export function refreshInternet(force = false) {
  if (inflight && !force) return inflight;
  inflight = fetch(`/api/internet${force ? "?force=1" : ""}`, { cache: "no-store" })
    .then((r) => (r.ok ? r.json() : null))
    .then((j) => j && set({ online: !!j.online, queued: Number(j.queued) || 0, checkedAt: Date.now() }))
    .catch(() => {})
    .finally(() => {
      inflight = null;
    });
  return inflight;
}

export function useInternet() {
  return useSyncExternalStore(
    (f) => {
      subs.add(f);
      return () => subs.delete(f);
    },
    () => state,
    () => state,
  );
}

/** Keeps the status fresh: every 30 s, when the window regains focus, and when Windows reports a network change. */
export function InternetWatcher() {
  useEffect(() => {
    refreshInternet();
    const t = setInterval(() => refreshInternet(), 30_000);
    const now = () => refreshInternet(true);
    window.addEventListener("online", now);
    window.addEventListener("offline", now);
    window.addEventListener("focus", now);
    return () => {
      clearInterval(t);
      window.removeEventListener("online", now);
      window.removeEventListener("offline", now);
      window.removeEventListener("focus", now);
    };
  }, []);
  return null;
}

export function InternetStatus({ compact = false, canWhatsApp = true }: { compact?: boolean; canWhatsApp?: boolean }) {
  const n = useInternet();
  const known = n.online !== null;
  const dot = !known ? "bg-gray-500" : n.online ? "bg-emerald-400" : "bg-amber-400";
  const label = !known ? "Checking internet…" : n.online ? "Online" : "No internet";
  if (compact)
    return (
      <span className="flex items-center gap-1.5 text-[11px] text-gray-400" role="status" aria-live="polite" title={n.online === false ? "Software works offline; WhatsApp messages will wait" : undefined}>
        <span className={`h-2 w-2 rounded-full ${dot}`} />
        {label}
      </span>
    );
  return (
    <div className="mx-3 mb-2 rounded-lg bg-white/[0.04] px-3 py-2 text-xs" role="status" aria-live="polite">
      <div className="flex items-center gap-2">
        <span className="relative flex h-2.5 w-2.5">
          {n.online && <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400 opacity-40" />}
          <span className={`relative inline-flex h-2.5 w-2.5 rounded-full ${dot}`} />
        </span>
        <span className="font-semibold text-gray-200">{label}</span>
        <button
          type="button"
          onClick={() => refreshInternet(true)}
          className="ml-auto rounded px-1 text-[11px] text-gray-500 hover:bg-white/10 hover:text-gray-200"
          aria-label="Check internet again"
          title="Check again"
        >
          Check
        </button>
      </div>
      <div className="mt-0.5 text-[11px] leading-snug text-gray-400">
        {!known ? "The software works with or without internet." : n.online ? "WhatsApp is ready." : "Everything still works. WhatsApp messages wait until the internet is back."}
      </div>
      {canWhatsApp && n.queued > 0 && (
        <Link href="/whatsapp#waiting" className={`mt-1.5 block rounded-md px-2 py-1 text-[11px] font-semibold ${n.online ? "bg-amber-400 text-gray-950 hover:bg-amber-300" : "bg-white/10 text-amber-300"}`}>
          {n.queued} WhatsApp {n.queued === 1 ? "message" : "messages"} waiting{n.online ? " – send now" : ""}
        </Link>
      )}
    </div>
  );
}
