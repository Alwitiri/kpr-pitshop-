"use client";

import { useMemo, useState } from "react";
import { Barcode } from "@/components/barcode";

type P = { id: number; name: string; sku: string; barcode: string | null; sellingPrice: number; mrp: number; size: string | null; color: string | null };

export function LabelPrinter({ products, initial }: { products: P[]; initial: number[] }) {
  const [counts, setCounts] = useState<Record<number, number>>(() => Object.fromEntries(initial.map((i) => [i, 1])));
  const [q, setQ] = useState("");
  const [showPrice, setShowPrice] = useState(true);
  const filtered = useMemo(
    () => products.filter((p) => !q || `${p.name} ${p.sku} ${p.barcode}`.toLowerCase().includes(q.toLowerCase())).slice(0, 60),
    [products, q],
  );
  const labels = products.flatMap((p) => Array.from({ length: counts[p.id] ?? 0 }, () => p));

  return (
    <div className="grid gap-5 lg:grid-cols-[380px_1fr]">
      <div className="card card-pad no-print">
        <input className="input mb-3" placeholder="Search products…" value={q} onChange={(e) => setQ(e.target.value)} />
        <label className="mb-3 flex items-center gap-2 text-sm">
          <input type="checkbox" checked={showPrice} onChange={(e) => setShowPrice(e.target.checked)} /> Show price on label
        </label>
        <ul className="max-h-[60vh] divide-y divide-gray-100 overflow-y-auto">
          {filtered.map((p) => (
            <li key={p.id} className="flex items-center justify-between gap-2 py-2 text-sm">
              <span className="min-w-0 truncate">{p.name} <span className="text-xs text-gray-400">{p.sku}</span></span>
              <input
                type="number"
                min={0}
                className="input w-16 py-1"
                value={counts[p.id] ?? 0}
                onChange={(e) => setCounts({ ...counts, [p.id]: Math.max(0, Number(e.target.value)) })}
              />
            </li>
          ))}
        </ul>
        <button className="btn-primary mt-4 w-full" disabled={!labels.length} onClick={() => window.print()}>
          Print {labels.length} labels
        </button>
      </div>
      <div className="card card-pad print:border-0 print:p-0 print:shadow-none">
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 xl:grid-cols-4 print:grid-cols-4 print:gap-1">
          {labels.map((p, i) => (
            <div key={i} className="flex flex-col items-center rounded border border-dashed border-gray-300 p-1.5 text-center break-inside-avoid">
              <div className="line-clamp-1 w-full text-[10px] font-semibold">{p.name}{p.size ? ` (${p.size})` : ""}</div>
              <Barcode value={p.barcode || p.sku} height={32} width={1.3} fontSize={10} />
              {showPrice && (
                <div className="text-[11px] font-bold">
                  ₹{p.sellingPrice.toFixed(0)} {p.mrp > p.sellingPrice && <span className="font-normal text-gray-500 line-through">MRP ₹{p.mrp.toFixed(0)}</span>}
                </div>
              )}
            </div>
          ))}
        </div>
        {!labels.length && <p className="py-10 text-center text-sm text-gray-400">Set a quantity next to products to preview labels.</p>}
      </div>
    </div>
  );
}
