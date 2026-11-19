"use client";

import Link from "next/link";
import { useState } from "react";
import { ActionForm, Submit } from "@/components/forms";
import { ProductPicker, type PickProduct } from "@/components/product-picker";
import { createPurchase } from "@/actions/purchases";
import { money, round2, ymd } from "@/lib/format";

type Line = { productId: number; name: string; qty: number; unitCost: number; gstRate: number };

export function PurchaseForm({ products, suppliers, defaultSupplier }: { products: PickProduct[]; suppliers: { id: number; name: string }[]; defaultSupplier?: number }) {
  const [lines, setLines] = useState<Line[]>([]);
  const [other, setOther] = useState(0);
  const [disc, setDisc] = useState(0);
  const [paid, setPaid] = useState(0);
  const [notFound, setNotFound] = useState<string | null>(null);

  const add = (p: PickProduct) => {
    const ex = lines.findIndex((l) => l.productId === p.id);
    if (ex >= 0) setLines(lines.map((l, i) => (i === ex ? { ...l, qty: l.qty + 1 } : l)));
    else setLines([...lines, { productId: p.id, name: p.name + (p.size ? ` · ${p.size}` : ""), qty: 1, unitCost: p.purchasePrice ?? 0, gstRate: p.gstRate }]);
  };
  const upd = (i: number, patch: Partial<Line>) => setLines(lines.map((l, j) => (j === i ? { ...l, ...patch } : l)));

  const subtotal = round2(lines.reduce((a, l) => a + l.qty * l.unitCost, 0));
  const tax = round2(lines.reduce((a, l) => a + round2((l.qty * l.unitCost * l.gstRate) / 100), 0));
  const total = round2(subtotal + tax + other - disc);

  return (
    <ActionForm action={createPurchase} className="space-y-5">
      <input type="hidden" name="lines" value={JSON.stringify(lines)} />
      <section className="card card-pad">
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <label>
            <span className="label">Supplier *</span>
            <select name="supplierId" className="input" defaultValue={defaultSupplier ?? ""} required>
              <option value="">Choose…</option>
              {suppliers.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
            </select>
            <Link href="/suppliers/new" className="mt-1 inline-block text-xs text-brand-700 hover:underline">+ Add new supplier</Link>
          </label>
          <label><span className="label">Supplier bill / invoice no.</span><input name="supplierBillNo" className="input" /></label>
          <label><span className="label">Bill date</span><input name="date" type="date" className="input" defaultValue={ymd()} /></label>
          <label><span className="label">Upload supplier bill (photo/PDF)</span><input name="attachment" type="file" accept="image/*,application/pdf" className="input py-1.5" /></label>
        </div>
      </section>

      <section className="card">
        <div className="border-b border-gray-100 p-4">
          <ProductPicker products={products} onPick={add} onNotFound={setNotFound} placeholder="Search or scan product to add…" />
          {notFound && (
            <div className="mt-2 flex flex-wrap items-center justify-between gap-2 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-900">
              <span>
                New item? Barcode <b className="font-mono">{notFound}</b> is not in the system. Add it (opens a new tab), then reload this page.
              </span>
              <span className="flex gap-2">
                <a className="btn-dark btn-sm" href={`/products/new?barcode=${encodeURIComponent(notFound)}`} target="_blank">Add product</a>
                <button type="button" className="btn-ghost btn-sm" onClick={() => setNotFound(null)}>Dismiss</button>
              </span>
            </div>
          )}
        </div>
        <div className="overflow-x-auto">
          <table className="table">
            <thead><tr><th>Product</th><th className="w-24">Qty</th><th className="w-36">Cost / unit (excl. GST)</th><th className="w-28">GST %</th><th className="text-right">Amount</th><th /></tr></thead>
            <tbody>
              {lines.map((l, i) => (
                <tr key={l.productId}>
                  <td className="font-medium">{l.name}</td>
                  <td><input type="number" min="1" step="1" className="input py-1" value={l.qty} onChange={(e) => upd(i, { qty: Number(e.target.value) })} /></td>
                  <td><input type="number" min="0" step="0.01" className="input py-1" value={l.unitCost} onChange={(e) => upd(i, { unitCost: Number(e.target.value) })} /></td>
                  <td>
                    <select className="input py-1" value={l.gstRate} onChange={(e) => upd(i, { gstRate: Number(e.target.value) })}>
                      {[0, 5, 12, 18, 28].map((r) => <option key={r} value={r}>{r}%</option>)}
                    </select>
                  </td>
                  <td className="text-right tabular-nums">{money(l.qty * l.unitCost * (1 + l.gstRate / 100))}</td>
                  <td><button type="button" className="text-xs text-red-600 hover:underline" onClick={() => setLines(lines.filter((_, j) => j !== i))}>Remove</button></td>
                </tr>
              ))}
            </tbody>
          </table>
          {!lines.length && <p className="p-6 text-center text-sm text-gray-400">No items yet. Search above to add products.</p>}
        </div>
      </section>

      <div className="grid gap-5 lg:grid-cols-2">
        <section className="card card-pad space-y-4">
          <div className="grid gap-4 sm:grid-cols-2">
            <label><span className="label">Freight / other charges</span><input name="otherCharges" type="number" step="0.01" min="0" className="input" value={other} onChange={(e) => setOther(Number(e.target.value))} /></label>
            <label><span className="label">Discount on bill</span><input name="discount" type="number" step="0.01" min="0" className="input" value={disc} onChange={(e) => setDisc(Number(e.target.value))} /></label>
            <label><span className="label">Amount paid now</span><input name="paidAmount" type="number" step="0.01" min="0" className="input" value={paid} onChange={(e) => setPaid(Number(e.target.value))} /></label>
            <label>
              <span className="label">Paid by</span>
              <select name="paymentMethod" className="input">{["CASH", "UPI", "BANK", "CARD", "CHEQUE"].map((m) => <option key={m}>{m}</option>)}</select>
            </label>
          </div>
          <label className="block"><span className="label">Notes</span><input name="notes" className="input" /></label>
          <label className="inline-flex items-center gap-2 text-sm"><input type="checkbox" name="updateCost" defaultChecked className="h-4 w-4" /> Update product purchase price to this bill&apos;s cost</label>
        </section>
        <section className="card card-pad">
          <dl className="space-y-2 text-sm">
            <div className="flex justify-between"><dt>Subtotal</dt><dd className="tabular-nums">{money(subtotal)}</dd></div>
            <div className="flex justify-between"><dt>GST</dt><dd className="tabular-nums">{money(tax)}</dd></div>
            <div className="flex justify-between"><dt>Other charges</dt><dd className="tabular-nums">{money(other)}</dd></div>
            <div className="flex justify-between"><dt>Discount</dt><dd className="tabular-nums">− {money(disc)}</dd></div>
            <div className="flex justify-between border-t pt-2 text-lg font-bold"><dt>Bill total</dt><dd className="tabular-nums">{money(total)}</dd></div>
            <div className="flex justify-between text-amber-700"><dt>Balance (credit)</dt><dd className="tabular-nums">{money(Math.max(0, total - paid))}</dd></div>
          </dl>
          <div className="mt-4 flex gap-2">
            <button type="button" className="btn-outline" onClick={() => setPaid(total)}>Mark fully paid</button>
            <Submit>Save purchase</Submit>
          </div>
        </section>
      </div>
    </ActionForm>
  );
}
