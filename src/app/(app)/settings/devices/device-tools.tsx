"use client";

import { useEffect, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { allowOtherDevices, checkFirewall } from "@/actions/devices";
import type { FirewallStatus } from "@/lib/network";

function Line({ ok, warn, children }: { ok: boolean | null; warn?: boolean; children: React.ReactNode }) {
  const cls = ok === null ? "bg-gray-300" : ok ? "bg-emerald-500" : warn ? "bg-amber-500" : "bg-red-500";
  return (
    <li className="flex items-start gap-2.5">
      <span className={`mt-1.5 h-2.5 w-2.5 shrink-0 rounded-full ${cls}`} aria-hidden />
      <span className="text-sm text-gray-800">{children}</span>
    </li>
  );
}

/** Live checks: app running, Windows Firewall, network type – with a fix button. */
export function ConnectionCheck({ onShopPc, isOwner, initial }: { onShopPc: boolean; isOwner: boolean; initial: FirewallStatus | null }) {
  // First result comes with the page (checked on the shop PC while the page was built)
  const [fw, setFw] = useState<FirewallStatus | null>(initial);
  const [msg, setMsg] = useState<{ ok?: string; error?: string } | null>(null);
  const [pending, start] = useTransition();
  const run = (force = false) => start(async () => setFw(await checkFirewall(force)));

  return (
    <div>
      <ul className="space-y-2.5">
        <Line ok={true}>Spoaxio Software is running and accepting other devices.</Line>
        <Line ok={fw ? (fw.checked ? fw.allowed : null) : null}>
          {!fw ? "Checking Windows Firewall…" : !fw.checked ? fw.note ?? "Windows Firewall could not be checked." : fw.allowed ? "Windows Firewall allows phones and other PCs." : fw.note ?? "Windows Firewall is blocking other devices."}
        </Line>
        {fw?.checked && (
          <Line ok={fw.networkCategory !== "Public" || fw.allowed} warn>
            This Wi-Fi is marked <b>{fw.networkCategory}</b> by Windows
            {fw.networkCategory === "Public" ? " (common for phone hotspots). That's fine once the firewall check is green." : "."}
          </Line>
        )}
      </ul>

      <div className="mt-4 flex flex-wrap gap-2">
        <button type="button" className="btn-outline btn-sm" disabled={pending} onClick={() => run(true)}>{pending ? "Checking…" : "Check again"}</button>
        {fw?.checked && !fw.allowed && (
          isOwner && onShopPc ? (
            <button
              type="button"
              className="btn-primary btn-sm"
              disabled={pending}
              onClick={() =>
                start(async () => {
                  const r = await allowOtherDevices();
                  setMsg(r);
                  if (r.ok) setTimeout(() => run(true), 12_000);
                })
              }
            >
              Allow phones &amp; other PCs
            </button>
          ) : (
            <span className="text-xs text-gray-600">
              {isOwner ? "Open this page on the shop PC to fix it, or use Start menu → Spoaxio Software → Allow phones & other PCs." : "Ask the owner to allow other devices."}
            </span>
          )
        )}
      </div>
      {msg && <p role="status" className={`mt-2 text-xs ${msg.ok ? "text-emerald-700" : "text-red-700"}`}>{msg.ok ?? msg.error}</p>}
      <p className="mt-3 text-xs text-gray-500">The firewall check covers this PC. If it is green and a phone still cannot connect, see “Not opening? Check these”.</p>
    </div>
  );
}

type Dev = { key: string; ip: string; label: string; user: string; role: string; ago: number; thisPc: boolean };

const agoText = (s: number) => (s < 60 ? "now" : s < 3600 ? `${Math.round(s / 60)} min ago` : `${Math.round(s / 3600)} h ago`);

/** Phones / PCs that opened the app since it started; refreshes every 20 s. */
export function DeviceList({ devices }: { devices: Dev[] }) {
  const router = useRouter();
  useEffect(() => {
    const t = setInterval(() => router.refresh(), 20_000);
    return () => clearInterval(t);
  }, [router]);
  if (!devices.length) return <p className="p-4 text-sm text-gray-600">No devices yet.</p>;
  return (
    <ul className="divide-y divide-gray-100">
      {devices.map((d) => (
        <li key={d.key} className="flex items-center gap-3 px-4 py-2.5 sm:px-5">
          <span className={`h-2.5 w-2.5 shrink-0 rounded-full ${d.ago < 90 ? "bg-emerald-500" : "bg-gray-300"}`} title={d.ago < 90 ? "Using it now" : "Seen earlier"} />
          <div className="min-w-0 flex-1">
            <div className="text-sm font-medium text-gray-900">{d.label}{d.thisPc && <span className="badge ml-1.5 bg-gray-100 text-gray-700">this PC</span>}</div>
            <div className="text-xs text-gray-500">{d.user} · {d.thisPc ? "shop PC" : d.ip}</div>
          </div>
          <span className="shrink-0 text-xs text-gray-500">{agoText(d.ago)}</span>
        </li>
      ))}
    </ul>
  );
}
