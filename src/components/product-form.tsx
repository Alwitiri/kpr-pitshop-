"use client";

import { useState, useTransition } from "react";
import { ActionForm, Submit } from "./forms";
import { Barcode } from "./barcode";
import { ImageInput } from "./image-input";
import { newBarcode, saveProduct } from "@/actions/products";
import { isValidEan13 } from "@/lib/barcode";

/** Barcode input: scan the maker's barcode, type one, or generate a shop barcode. */
function BarcodeField({ initial }: { initial: string }) {
  const [code, setCode] = useState(initial);
  const [pending, start] = useTransition();
  return (
    <div className="sm:col-span-2 lg:col-span-4">
      <span className="label">Barcode</span>
      <div className="flex flex-wrap items-start gap-3">
        <div className="min-w-60 flex-1">
          <div className="flex gap-2">
            <input
              name="barcode"
              className="input font-mono"
              value={code}
              onChange={(e) => setCode(e.target.value.trim())}
              // A scanner presses Enter after the code: don't submit the whole form
              onKeyDown={(e) => e.key === "Enter" && e.preventDefault()}
              placeholder="Scan the barcode on the item, or click Generate"
            />
            <button type="button" className="btn-outline" disabled={pending} onClick={() => start(async () => setCode(await newBarcode()))}>
              {pending ? "…" : "Generate"}
            </button>
          </div>
          <p className="mt-1 text-xs text-gray-500">
            Item already has a barcode from the company? Click in the box and scan it. No barcode? Leave empty or click
            Generate – a shop barcode is created automatically when you save.
          </p>
          {code && /^\d{13}$/.test(code) && !isValidEan13(code) && (
            <p className="mt-1 text-xs text-amber-700">This 13-digit code has a wrong check digit – it will print as Code 128.</p>
          )}
        </div>
        {code && (
          <div className="rounded-lg border bg-white px-2">
            <Barcode value={code} height={40} width={1.4} fontSize={11} />
          </div>
        )}
      </div>
    </div>
  );
}

type Opt = { id: number; name: string };
type Fit = { vehicleType: string; make: string; model?: string | null; yearFrom?: number | null; yearTo?: number | null };
export type ProductFormData = {
  id?: number;
  name?: string;
  sku?: string;
  barcode?: string | null;
  categoryId?: number | null;
  stock?: number;
  brandId?: number | null;
  supplierId?: number | null;
  variantGroup?: string | null;
  size?: string | null;
  color?: string | null;
  unit?: string;
  hsn?: string | null;
  purchasePrice?: number;
  sellingPrice?: number;
  mrp?: number;
  gstRate?: number;
  minStock?: number;
  warrantyMonths?: number;
  description?: string | null;
  location?: string | null;
  active?: boolean;
  imageUrl?: string | null;
  fitments?: Fit[];
};

export function ProductForm({
  p,
  categories,
  brands,
  suppliers,
  defaultMinStock,
}: {
  p?: ProductFormData;
  categories: Opt[];
  brands: Opt[];
  suppliers: Opt[];
  defaultMinStock: number;
}) {
  const isNew = !p?.id;
  const [fits, setFits] = useState<Fit[]>(p?.fitments ?? []);
  const [cost, setCost] = useState(p?.purchasePrice ?? 0);
  const [sell, setSell] = useState(p?.sellingPrice ?? 0);
  const [gst, setGst] = useState(p?.gstRate ?? 18);
  const costInclGst = cost * (1 + gst / 100);
  const margin = sell - costInclGst;
  const marginPct = sell > 0 ? (margin / sell) * 100 : 0;

  return (
    <ActionForm action={saveProduct} className="space-y-5">
      {p?.id && <input type="hidden" name="id" value={p.id} />}
      {isNew && <input type="hidden" name="_new" value="1" />}
      <input type="hidden" name="fitments" value={JSON.stringify(fits)} />

      <section className="card card-pad">
        <h2 className="mb-4 text-sm font-semibold">Basic details</h2>
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <label className="sm:col-span-2">
            <span className="label">Product name *</span>
            <input name="name" className="input" defaultValue={p?.name} required />
          </label>
          <label>
            <span className="label">SKU / Item code</span>
            <input name="sku" className="input" defaultValue={p?.sku} placeholder={isNew ? "Auto (KPR-0001)" : ""} />
          </label>
          <BarcodeField initial={p?.barcode ?? ""} />
          <label>
            <span className="label">Category</span>
            <select name="categoryId" className="input" defaultValue={p?.categoryId ?? ""}>
              <option value="">—</option>
              {categories.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
            </select>
          </label>
          <label>
            <span className="label">Brand</span>
            <select name="brandId" className="input" defaultValue={p?.brandId ?? ""}>
              <option value="">—</option>
              {brands.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
            </select>
          </label>
          <label>
            <span className="label">Main supplier</span>
            <select name="supplierId" className="input" defaultValue={p?.supplierId ?? ""}>
              <option value="">—</option>
              {suppliers.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
            </select>
          </label>
          <label>
            <span className="label">Shelf / rack location</span>
            <input name="location" className="input" defaultValue={p?.location ?? ""} placeholder="e.g. Rack A2" />
          </label>
        </div>
      </section>

      <section className="card card-pad">
        <h2 className="mb-1 text-sm font-semibold">Variant</h2>
        <p className="mb-4 text-xs text-gray-500">
          Each size / colour is its own item with its own stock. Give all variants the same group name to link them.
        </p>
        <div className="grid gap-4 sm:grid-cols-4">
          <label>
            <span className="label">Variant group</span>
            <input name="variantGroup" className="input" defaultValue={p?.variantGroup ?? ""} placeholder="e.g. SBA-1 Helmet" />
          </label>
          <label>
            <span className="label">Size</span>
            <input name="size" className="input" defaultValue={p?.size ?? ""} placeholder="M / L / 90/90-17" />
          </label>
          <label>
            <span className="label">Colour</span>
            <input name="color" className="input" defaultValue={p?.color ?? ""} />
          </label>
          <label>
            <span className="label">Unit</span>
            <select name="unit" className="input" defaultValue={p?.unit ?? "PCS"}>
              {["PCS", "PAIR", "SET", "LTR", "ML", "KG", "MTR", "BOX"].map((u) => <option key={u}>{u}</option>)}
            </select>
          </label>
        </div>
      </section>

      <section className="card card-pad">
        <h2 className="mb-4 text-sm font-semibold">Pricing & GST</h2>
        <div className="grid gap-4 sm:grid-cols-3 lg:grid-cols-6">
          <label>
            <span className="label">Purchase price (excl. GST)</span>
            <input name="purchasePrice" type="number" step="0.01" min="0" className="input" value={cost} onChange={(e) => setCost(Number(e.target.value))} />
          </label>
          <label>
            <span className="label">Selling price (incl. GST) *</span>
            <input name="sellingPrice" type="number" step="0.01" min="0" className="input" value={sell} onChange={(e) => setSell(Number(e.target.value))} required />
          </label>
          <label>
            <span className="label">MRP</span>
            <input name="mrp" type="number" step="0.01" min="0" className="input" defaultValue={p?.mrp ?? 0} />
          </label>
          <label>
            <span className="label">GST rate</span>
            <select name="gstRate" className="input" value={gst} onChange={(e) => setGst(Number(e.target.value))}>
              {[0, 5, 12, 18, 28].map((r) => <option key={r} value={r}>{r}%</option>)}
            </select>
          </label>
          <label>
            <span className="label">HSN code</span>
            <input name="hsn" className="input" defaultValue={p?.hsn ?? ""} />
          </label>
          <div className="rounded-lg bg-gray-50 p-2.5 text-sm">
            <div className="label">Margin per unit</div>
            <div className={`font-bold ${margin < 0 ? "text-red-600" : "text-emerald-700"}`}>
              ₹{margin.toFixed(2)} <span className="text-xs font-medium">({marginPct.toFixed(1)}%)</span>
            </div>
          </div>
        </div>
      </section>

      <section className="card card-pad">
        <h2 className="mb-4 text-sm font-semibold">Stock & warranty</h2>
        <div className="grid gap-4 sm:grid-cols-4">
          {isNew && (
            <label>
              <span className="label">Opening stock</span>
              <input name="openingStock" type="number" step="1" min="0" className="input" defaultValue={0} />
            </label>
          )}
          <label>
            <span className="label">Minimum stock (alert level)</span>
            <input name="minStock" type="number" step="1" min="0" className="input" defaultValue={p?.minStock ?? defaultMinStock} />
          </label>
          <label>
            <span className="label">Warranty (months)</span>
            <input name="warrantyMonths" type="number" step="1" min="0" className="input" defaultValue={p?.warrantyMonths ?? 0} />
          </label>
          <label>
            <span className="label">Product image</span>
            <ImageInput name="image" mode="photo" />
          </label>
        </div>
        <label className="mt-4 block">
          <span className="label">Description / notes</span>
          <textarea name="description" rows={2} className="input" defaultValue={p?.description ?? ""} />
        </label>
        {!isNew && (
          <label className="mt-4 inline-flex items-center gap-2 text-sm">
            <input type="checkbox" name="active" defaultChecked={p?.active ?? true} className="h-4 w-4" /> Active (show in billing)
          </label>
        )}
      </section>

      <section className="card card-pad">
        <div className="mb-3 flex items-center justify-between">
          <div>
            <h2 className="text-sm font-semibold">Vehicle compatibility</h2>
            <p className="text-xs text-gray-500">Which bikes / cars this fits. Leave empty for universal items.</p>
          </div>
          <button type="button" className="btn-outline btn-sm" onClick={() => setFits([...fits, { vehicleType: "BIKE", make: "", model: "" }])}>
            + Add vehicle
          </button>
        </div>
        {fits.length === 0 && <p className="text-sm text-gray-400">Universal – fits all vehicles.</p>}
        <div className="space-y-2">
          {fits.map((f, i) => {
            const upd = (patch: Partial<Fit>) => setFits(fits.map((x, j) => (j === i ? { ...x, ...patch } : x)));
            return (
              <div key={i} className="grid grid-cols-2 gap-2 sm:grid-cols-[100px_1fr_1fr_90px_90px_auto]">
                <select className="input" value={f.vehicleType} onChange={(e) => upd({ vehicleType: e.target.value })}>
                  <option value="BIKE">Bike</option>
                  <option value="CAR">Car</option>
                </select>
                <input className="input" placeholder="Make (e.g. Royal Enfield)" value={f.make} onChange={(e) => upd({ make: e.target.value })} />
                <input className="input" placeholder="Model (e.g. Classic 350)" value={f.model ?? ""} onChange={(e) => upd({ model: e.target.value })} />
                <input className="input" type="number" placeholder="Year from" value={f.yearFrom ?? ""} onChange={(e) => upd({ yearFrom: e.target.value ? Number(e.target.value) : null })} />
                <input className="input" type="number" placeholder="Year to" value={f.yearTo ?? ""} onChange={(e) => upd({ yearTo: e.target.value ? Number(e.target.value) : null })} />
                <button type="button" className="btn-danger btn-sm" onClick={() => setFits(fits.filter((_, j) => j !== i))}>Remove</button>
              </div>
            );
          })}
        </div>
      </section>

      <div className="flex justify-end">
        <Submit>{isNew ? "Create product" : "Save changes"}</Submit>
      </div>
    </ActionForm>
  );
}
