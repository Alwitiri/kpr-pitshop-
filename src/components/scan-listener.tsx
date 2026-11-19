"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { lookupCode, type ScanResult } from "@/actions/scan";

/**
 * USB / Bluetooth barcode scanners act like a very fast keyboard that ends with Enter.
 * When no text box is focused, this catches such bursts anywhere in the app:
 *   product barcode -> opens the product (or shows price & stock for counter staff)
 *   bill barcode    -> opens that bill (for returns / reprints)
 *   unknown code    -> offers to add it as a new product
 * Screens with their own scanner handling (POS) cancel the "kpr-scan" event.
 */
export function ScanListener({ canProducts, canSales }: { canProducts: boolean; canSales: boolean }) {
  const router = useRouter();
  const buf = useRef<{ s: string; t: number[] }>({ s: "", t: [] });
  const [toast, setToast] = useState<ScanResult | null>(null);

  useEffect(() => {
    const handle = async (code: string, typed = false) => {
      const ev = new CustomEvent("kpr-scan", { detail: code, cancelable: true });
      if (!window.dispatchEvent(ev)) return; // a screen handled it
      const r = await lookupCode(code).catch(() => null);
      if (!r) return;
      if (r.type === "product" && canProducts) return router.push(`/products/${r.id}`);
      if (r.type === "sale" && canSales) return router.push(`/sales/${r.id}`);
      // Typed words in the find box (e.g. "helmet") -> product search
      if (r.type === "none" && typed && canProducts && /[a-z]{2,}|\s/i.test(code)) return router.push(`/products?q=${encodeURIComponent(code)}`);
      setToast(r);
    };
    const onFind = (e: Event) => handle((e as CustomEvent<string>).detail, true);

    const onKey = (e: KeyboardEvent) => {
      const el = document.activeElement as HTMLElement | null;
      const typing = el && (el.tagName === "INPUT" || el.tagName === "TEXTAREA" || el.tagName === "SELECT" || el.isContentEditable);
      if (typing || e.ctrlKey || e.altKey || e.metaKey) return;
      const now = performance.now();
      const b = buf.current;
      const gap = b.t.length ? now - b.t[b.t.length - 1] : 0;
      if (e.key === "Enter") {
        // characters arrived scanner-fast, and Enter followed shortly after (some scanners pause before Enter)
        const fast = b.t.length >= 4 && (b.t[b.t.length - 1] - b.t[0]) / (b.t.length - 1) < 40 && gap < 300;
        const code = b.s;
        b.s = "";
        b.t = [];
        if (fast && code.length >= 4) {
          e.preventDefault();
          handle(code);
        }
        return;
      }
      if (e.key.length === 1) {
        if (gap > 60) b.s = "", (b.t = []); // a human typing slowly – start over
        b.s += e.key;
        b.t.push(now);
      }
    };
    window.addEventListener("keydown", onKey, true);
    window.addEventListener("kpr-find", onFind);
    return () => {
      window.removeEventListener("keydown", onKey, true);
      window.removeEventListener("kpr-find", onFind);
    };
  }, [router, canProducts, canSales]);

  useEffect(() => {
    if (!toast) return;
    const t = setTimeout(() => setToast(null), 8000);
    return () => clearTimeout(t);
  }, [toast]);

  if (!toast) return null;
  return (
    <div className="fixed bottom-4 right-4 z-[60] w-80 rounded-xl border border-gray-200 bg-white p-4 shadow-xl no-print">
      <button className="absolute right-2 top-2 text-gray-400 hover:text-gray-700" onClick={() => setToast(null)} aria-label="Close">✕</button>
      {toast.type === "product" && (
        <>
          <div className="text-xs font-semibold uppercase text-gray-500">Scanned product</div>
          <div className="mt-1 font-semibold">{toast.name}</div>
          <div className="mt-1 text-2xl font-bold">₹{toast.sellingPrice.toLocaleString("en-IN")}</div>
          {toast.mrp > toast.sellingPrice && <div className="text-xs text-gray-500 line-through">MRP ₹{toast.mrp.toLocaleString("en-IN")}</div>}
          <div className={`mt-1 text-sm ${toast.stock > 0 ? "text-emerald-700" : "text-red-600"}`}>
            {toast.stock > 0 ? `${toast.stock} in stock` : "Out of stock"}{toast.location ? ` · ${toast.location}` : ""}
          </div>
        </>
      )}
      {toast.type === "sale" && <div className="text-sm">Bill <b>{toast.invoiceNo}</b> – you don&apos;t have access to open bills.</div>}
      {toast.type === "none" && (
        <>
          <div className="text-xs font-semibold uppercase text-gray-500">Not found</div>
          <div className="mt-1 text-sm">
            Nothing has the code <span className="font-mono font-semibold">{toast.code}</span>.
          </div>
          {canProducts && (
            <Link className="btn-primary btn-sm mt-3" href={`/products/new?barcode=${encodeURIComponent(toast.code)}`} onClick={() => setToast(null)}>
              Add as new product
            </Link>
          )}
        </>
      )}
    </div>
  );
}

/** Sidebar box: scan or type a barcode / bill number. */
export function QuickFind() {
  const [v, setV] = useState("");
  return (
    <form
      className="px-3 pb-2"
      onSubmit={(e) => {
        e.preventDefault();
        if (!v.trim()) return;
        window.dispatchEvent(new CustomEvent("kpr-find", { detail: v.trim() }));
        setV("");
        (e.currentTarget.querySelector("input") as HTMLInputElement | null)?.blur();
      }}
    >
      <input
        value={v}
        onChange={(e) => setV(e.target.value)}
        placeholder="Scan / find barcode or bill no."
        className="w-full rounded-lg border border-white/10 bg-white/5 px-3 py-1.5 text-sm text-white placeholder:text-gray-500 outline-none focus:border-brand-500"
      />
    </form>
  );
}
