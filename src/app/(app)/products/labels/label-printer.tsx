"use client";

import { useEffect, useMemo, useState } from "react";
import { Barcode } from "@/components/barcode";
import { ActionForm, Submit } from "@/components/forms";
import { generateMissingBarcodes } from "@/actions/products";

type P = { id: number; name: string; sku: string; barcode: string | null; sellingPrice: number; mrp: number; size: string | null; color: string | null; stock: number };

type Preset = {
  key: string;
  label: string;
  w: number; // label width mm
  h: number; // label height mm
  roll: boolean; // one label per page (thermal label printer)
  cols?: number;
  rows?: number;
  top?: number; // A4 margins / gaps in mm
  left?: number;
  gapX?: number;
  gapY?: number;
};

const PRESETS: Preset[] = [
  { key: "roll50x25", label: "Sticker roll 50 × 25 mm (thermal label printer)", w: 50, h: 25, roll: true },
  { key: "roll38x25", label: "Sticker roll 38 × 25 mm (thermal label printer)", w: 38, h: 25, roll: true },
  { key: "roll50x30", label: "Sticker roll 50 × 30 mm (thermal label printer)", w: 50, h: 30, roll: true },
  { key: "a4-65", label: "A4 sticker sheet – 65 per sheet (38.1 × 21.2 mm)", w: 38.1, h: 21.2, roll: false, cols: 5, rows: 13, top: 10.7, left: 4.65, gapX: 2.5, gapY: 0 },
  { key: "a4-24", label: "A4 sticker sheet – 24 per sheet (70 × 37 mm)", w: 70, h: 37, roll: false, cols: 3, rows: 8, top: 0.5, left: 0, gapX: 0, gapY: 0 },
];

function load<T>(k: string, d: T): T {
  try {
    const v = localStorage.getItem(k);
    return v ? (JSON.parse(v) as T) : d;
  } catch {
    return d;
  }
}
function save(k: string, v: unknown) {
  try {
    localStorage.setItem(k, JSON.stringify(v));
  } catch {
    /* private mode */
  }
}

export function LabelPrinter({ products, initial, shopName, missingBarcodes }: { products: P[]; initial: Record<number, number>; shopName: string; missingBarcodes: number }) {
  const [counts, setCounts] = useState<Record<number, number>>(initial);
  const [q, setQ] = useState("");
  const [presetKey, setPresetKey] = useState("roll50x25");
  const [showPrice, setShowPrice] = useState(true);
  const [showShop, setShowShop] = useState(true);
  const [skip, setSkip] = useState(0);

  useEffect(() => {
    setPresetKey(load("kpr.labels.preset", "roll50x25"));
    setShowPrice(load("kpr.labels.price", true));
    setShowShop(load("kpr.labels.shop", true));
  }, []);

  const preset = PRESETS.find((p) => p.key === presetKey) ?? PRESETS[0];
  const filtered = useMemo(() => {
    const t = q.trim().toLowerCase();
    const list = t ? products.filter((p) => `${p.name} ${p.sku} ${p.barcode ?? ""}`.toLowerCase().includes(t)) : products;
    // selected first
    return [...list].sort((a, b) => Number(!!counts[b.id]) - Number(!!counts[a.id])).slice(0, 80);
  }, [products, q, counts]);

  const labels = products.flatMap((p) => Array.from({ length: counts[p.id] ?? 0 }, () => p));
  const perSheet = preset.roll ? 1 : (preset.cols ?? 1) * (preset.rows ?? 1);
  const slots: (P | null)[] = preset.roll ? labels : [...Array(Math.min(skip, perSheet - 1)).fill(null), ...labels];
  const sheets: (P | null)[][] = [];
  for (let i = 0; i < slots.length; i += perSheet) sheets.push(slots.slice(i, i + perSheet));

  const setCount = (id: number, n: number) => setCounts({ ...counts, [id]: Math.max(0, Math.round(n)) });

  // Scanner on this page: scan an item to add one more sticker for it
  const onScan = (code: string) => {
    const c = code.trim().toLowerCase();
    const p = products.find((x) => x.barcode?.toLowerCase() === c || x.sku.toLowerCase() === c);
    if (p) setCount(p.id, (counts[p.id] ?? 0) + 1);
    setQ("");
  };

  const pageCss = preset.roll
    ? `@page { size: ${preset.w}mm ${preset.h}mm; margin: 0 }`
    : `@page { size: A4; margin: 0 }`;

  const Label = ({ p }: { p: P | null }) => (
    <div className="kpr-label" style={{ width: `${preset.w}mm`, height: `${preset.h}mm` }}>
      {p && (
        <div className="flex h-full flex-col items-center justify-between overflow-hidden px-[1.5mm] py-[1mm] text-center leading-tight text-black">
          {showShop && <div className="w-full truncate text-[6pt] font-semibold uppercase tracking-wide">{shopName}</div>}
          <div className="line-clamp-2 w-full text-[7pt] font-semibold">
            {p.name}
            {p.size ? ` · ${p.size}` : ""}
            {p.color ? ` · ${p.color}` : ""}
          </div>
          <div className="flex min-h-0 w-full flex-1 items-center justify-center">
            <Barcode value={p.barcode || p.sku} fit height={50} width={2} fontSize={14} className="h-full max-h-full w-full" />
          </div>
          {showPrice && (
            <div className="text-[8pt] font-bold">
              ₹{p.sellingPrice.toLocaleString("en-IN")}
              {p.mrp > p.sellingPrice && <span className="ml-1 text-[6pt] font-normal line-through">MRP ₹{p.mrp.toLocaleString("en-IN")}</span>}
            </div>
          )}
        </div>
      )}
    </div>
  );

  return (
    <>
      <style>{`
        ${pageCss}
        .kpr-label { box-sizing: border-box; background: white; }
        @media screen { .kpr-label { outline: 1px dashed #cbd5e1; } }
        @media print {
          body * { visibility: hidden !important; }
          .kpr-print, .kpr-print * { visibility: visible !important; }
          .kpr-print { position: absolute; left: 0; top: 0; }
          .kpr-sheet { break-after: page; }
          .kpr-sheet:last-child { break-after: auto; }
        }
      `}</style>

      <div className="grid gap-5 lg:grid-cols-[400px_1fr] no-print">
        <div className="space-y-4">
          {missingBarcodes > 0 && (
            <div className="rounded-xl border border-amber-200 bg-amber-50 p-3 text-sm text-amber-900">
              <b>{missingBarcodes} products have no barcode yet.</b> Create shop barcodes for all of them in one click.
              <ActionForm action={generateMissingBarcodes} className="mt-2">
                <Submit className="btn-dark btn-sm">Generate missing barcodes</Submit>
              </ActionForm>
            </div>
          )}
          <div className="card card-pad space-y-3">
            <label className="block">
              <span className="label">Sticker type</span>
              <select className="input" value={presetKey} onChange={(e) => { setPresetKey(e.target.value); save("kpr.labels.preset", e.target.value); }}>
                {PRESETS.map((p) => <option key={p.key} value={p.key}>{p.label}</option>)}
              </select>
            </label>
            {!preset.roll && (
              <label className="block">
                <span className="label">Sheet already partly used? Skip this many stickers</span>
                <input type="number" min={0} max={perSheet - 1} className="input" value={skip} onChange={(e) => setSkip(Math.max(0, Number(e.target.value)))} />
              </label>
            )}
            <div className="flex flex-wrap gap-4 text-sm">
              <label className="flex items-center gap-2"><input type="checkbox" checked={showPrice} onChange={(e) => { setShowPrice(e.target.checked); save("kpr.labels.price", e.target.checked); }} /> Price & MRP</label>
              <label className="flex items-center gap-2"><input type="checkbox" checked={showShop} onChange={(e) => { setShowShop(e.target.checked); save("kpr.labels.shop", e.target.checked); }} /> Shop name</label>
            </div>
            <button className="btn-primary w-full py-2.5" disabled={!labels.length} onClick={() => window.print()}>
              Print {labels.length} sticker{labels.length === 1 ? "" : "s"}
              {!preset.roll && labels.length > 0 && ` (${sheets.length} sheet${sheets.length === 1 ? "" : "s"})`}
            </button>
            {preset.roll && (
              <p className="text-xs text-gray-500">
                In the print window choose your label printer, set <b>Margins: None</b> and <b>Scale: 100%</b>. Paper size should match {preset.w} × {preset.h} mm.
              </p>
            )}
            {!preset.roll && <p className="text-xs text-gray-500">Print on A4 at <b>Scale: 100% / Actual size</b> with <b>Margins: None</b>.</p>}
          </div>

          <div className="card card-pad">
            <div className="mb-2 flex items-center justify-between gap-2">
              <span className="label mb-0">Products</span>
              <span className="flex gap-2">
                <button className="text-xs font-medium text-link hover:underline" onClick={() => setCounts(Object.fromEntries(filtered.filter((p) => p.stock > 0).map((p) => [p.id, Math.round(p.stock)])))}>
                  Qty = stock (shown)
                </button>
                <button className="text-xs text-gray-500 hover:underline" onClick={() => setCounts({})}>Clear</button>
              </span>
            </div>
            <input
              className="input mb-2"
              placeholder="Search, or scan an item to add +1 sticker"
              value={q}
              onChange={(e) => setQ(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  e.preventDefault();
                  onScan(q);
                }
              }}
            />
            <ul className="max-h-[50vh] divide-y divide-gray-100 overflow-y-auto">
              {filtered.map((p) => (
                <li key={p.id} className={`flex items-center justify-between gap-2 py-1.5 text-sm ${counts[p.id] ? "font-medium" : ""}`}>
                  <span className="min-w-0">
                    <span className="block truncate">{p.name}{p.size ? ` · ${p.size}` : ""}</span>
                    <span className="font-mono text-[11px] text-gray-400">{p.barcode ?? `${p.sku} (no barcode)`} · stock {p.stock}</span>
                  </span>
                  <input type="number" min={0} className="input w-16 py-1" value={counts[p.id] ?? 0} onChange={(e) => setCount(p.id, Number(e.target.value))} />
                </li>
              ))}
            </ul>
          </div>
        </div>

        <div className="card card-pad overflow-auto">
          <div className="mb-3 text-sm text-gray-500">Preview (actual size)</div>
          {!labels.length && <p className="py-10 text-center text-sm text-gray-400">Set a quantity next to products to see the stickers.</p>}
          <div className="flex flex-wrap gap-2">
            {preset.roll
              ? labels.slice(0, 60).map((p, i) => <Label key={i} p={p} />)
              : sheets.slice(0, 1).map((s, i) => (
                  <div key={i} className="origin-top-left scale-[0.6] border bg-white" style={{ width: "210mm", height: "297mm" }}>
                    <Sheet preset={preset} slots={s} Label={Label} />
                  </div>
                ))}
          </div>
          {preset.roll && labels.length > 60 && <p className="mt-2 text-xs text-gray-500">…and {labels.length - 60} more.</p>}
        </div>
      </div>

      {/* What actually gets printed */}
      <div className="kpr-print hidden print:block">
        {preset.roll
          ? labels.map((p, i) => (
              <div key={i} className="kpr-sheet">
                <Label p={p} />
              </div>
            ))
          : sheets.map((s, i) => (
              <div key={i} className="kpr-sheet" style={{ width: "210mm", height: "297mm" }}>
                <Sheet preset={preset} slots={s} Label={Label} />
              </div>
            ))}
      </div>
    </>
  );
}

function Sheet({ preset, slots, Label }: { preset: Preset; slots: (P | null)[]; Label: (props: { p: P | null }) => React.ReactElement }) {
  return (
    <div
      style={{
        paddingTop: `${preset.top}mm`,
        paddingLeft: `${preset.left}mm`,
        display: "grid",
        gridTemplateColumns: `repeat(${preset.cols}, ${preset.w}mm)`,
        gridAutoRows: `${preset.h}mm`,
        columnGap: `${preset.gapX}mm`,
        rowGap: `${preset.gapY}mm`,
      }}
    >
      {slots.map((p, i) => <Label key={i} p={p} />)}
    </div>
  );
}
