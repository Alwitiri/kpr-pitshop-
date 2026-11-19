"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { cleanCode } from "@/lib/barcode";

export type PickProduct = {
  id: number;
  name: string;
  sku: string;
  barcode?: string | null;
  stock: number;
  sellingPrice: number;
  purchasePrice?: number;
  gstRate: number;
  size?: string | null;
  color?: string | null;
  hsn?: string | null;
  unit?: string;
};

/** Type-ahead product search. Enter on an exact barcode/SKU match selects it instantly (scanner friendly). */
export function ProductPicker({
  products,
  onPick,
  placeholder = "Search product name / SKU or scan barcode…",
  autoFocus,
  name,
  defaultId,
  onNotFound,
}: {
  products: PickProduct[];
  onPick?: (p: PickProduct) => void;
  /** Called when Enter (or a scanner) gives a code that matches no product. */
  onNotFound?: (code: string) => void;
  placeholder?: string;
  autoFocus?: boolean;
  name?: string; // when set, renders a hidden input with the chosen id (for plain forms)
  defaultId?: number;
}) {
  const [q, setQ] = useState("");
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState(0);
  const [chosen, setChosen] = useState<PickProduct | null>(() => products.find((p) => p.id === defaultId) ?? null);
  const box = useRef<HTMLDivElement>(null);

  const search = (raw: string) => {
    const t = raw.trim().toLowerCase();
    if (!t) return [];
    const words = t.split(/\s+/);
    return products
      .filter((p) => {
        const hay = `${p.name} ${p.sku} ${p.barcode ?? ""} ${p.size ?? ""} ${p.color ?? ""}`.toLowerCase();
        return words.every((w) => hay.includes(w));
      })
      .slice(0, 12);
  };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  const results = useMemo(() => search(q), [q, products]);

  useEffect(() => {
    const close = (e: MouseEvent) => {
      if (box.current && !box.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", close);
    return () => document.removeEventListener("mousedown", close);
  }, []);

  const pick = (p: PickProduct) => {
    onPick?.(p);
    if (name) setChosen(p);
    setQ("");
    setOpen(false);
    setActive(0);
  };

  return (
    <div ref={box} className="relative">
      {name && <input type="hidden" name={name} value={chosen?.id ?? ""} />}
      <input
        className="input"
        value={q}
        autoFocus={autoFocus}
        placeholder={chosen ? `${chosen.name} (${chosen.sku}) – type to change` : placeholder}
        onChange={(e) => {
          setQ(e.target.value);
          setOpen(true);
          setActive(0);
        }}
        onFocus={() => setOpen(true)}
        onKeyDown={(e) => {
          if (e.key === "Enter") {
            e.preventDefault();
            // Read the box directly: a scanner types + presses Enter faster than React re-renders
            const raw = e.currentTarget.value;
            const t = cleanCode(raw).toLowerCase();
            if (!t) return;
            const exact = products.find((p) => p.barcode?.toLowerCase() === t || p.sku.toLowerCase() === t);
            if (exact) return pick(exact);
            const fresh = raw === q ? results : search(raw);
            if (fresh[active] ?? fresh[0]) return pick(fresh[active] ?? fresh[0]);
            // Nothing matched – most likely a barcode that is not in the system yet
            onNotFound?.(cleanCode(raw));
            setQ("");
            setOpen(false);
          } else if (e.key === "ArrowDown") {
            e.preventDefault();
            setActive((a) => Math.min(a + 1, results.length - 1));
          } else if (e.key === "ArrowUp") {
            e.preventDefault();
            setActive((a) => Math.max(a - 1, 0));
          } else if (e.key === "Escape") setOpen(false);
        }}
      />
      {name && chosen && !q && (
        <div className="mt-1 text-xs text-gray-600">
          Selected: <b>{chosen.name}</b> · stock {chosen.stock}
        </div>
      )}
      {open && results.length > 0 && (
        <ul className="absolute z-30 mt-1 max-h-80 w-full overflow-y-auto rounded-lg border border-gray-200 bg-white shadow-lg">
          {results.map((p, i) => (
            <li key={p.id}>
              <button
                type="button"
                onMouseDown={(e) => e.preventDefault()}
                onClick={() => pick(p)}
                className={`flex w-full items-center justify-between gap-3 px-3 py-2 text-left text-sm ${i === active ? "bg-brand-50" : "hover:bg-gray-50"}`}
              >
                <span className="min-w-0">
                  <span className="block truncate font-medium">{p.name}{p.size ? ` · ${p.size}` : ""}{p.color ? ` · ${p.color}` : ""}</span>
                  <span className="text-xs text-gray-500">{p.sku}</span>
                </span>
                <span className="shrink-0 text-right text-xs">
                  <span className="block font-semibold">₹{p.sellingPrice}</span>
                  <span className={p.stock <= 0 ? "text-red-600" : "text-gray-500"}>stock {p.stock}</span>
                </span>
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
