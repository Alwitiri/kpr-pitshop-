"use client";

import Link from "next/link";
import { useEffect, useMemo, useRef, useState, useTransition } from "react";
import { ProductPicker, type PickProduct } from "@/components/product-picker";
import { calcBill } from "@/lib/calc";
import { money, round2 } from "@/lib/format";
import { createSale, deleteHeldBill, holdBill, listHeldBills, searchCustomers } from "@/actions/sales";
import { Icon } from "@/components/icons";
import { WhatsAppButton } from "@/components/whatsapp-button";

type Line = { productId: number | null; name: string; hsn?: string | null; qty: number; unitPrice: number; discount: number; gstRate: number; stock: number };
type Vehicle = { id: number; type: string; make: string; model: string | null; regNo: string | null };
type Customer = { id: number; name: string; phone: string | null; whatsappOptIn: boolean; vehicles: Vehicle[] };
type Pay = { method: string; amount: number; reference?: string };
type Held = { id: number; label: string; data: string; createdAt: Date };
export type PosPreload = { jobCardId: number; jobNumber: string; customer: Customer; vehicleId: number | null; lines: Line[] };

const METHODS = ["CASH", "UPI", "CARD", "BANK"];

export function PosScreen({ products, canEditPrice, canAddProduct, preload, shopState }: { products: PickProduct[]; canEditPrice: boolean; canAddProduct: boolean; preload: PosPreload | null; shopState: string }) {
  const [lines, setLines] = useState<Line[]>(preload?.lines ?? []);
  const [billDiscount, setBillDiscount] = useState(0);
  const [interState, setInterState] = useState(false);
  const [customer, setCustomer] = useState<Customer | null>(preload?.customer ?? null);
  const [vehicleId, setVehicleId] = useState<number | null>(preload?.vehicleId ?? null);
  const [walkInName, setWalkInName] = useState("");
  const [newCust, setNewCust] = useState<null | { name: string; phone: string; whatsappOptIn: boolean; vType: string; make: string; model: string; regNo: string }>(null);
  const [pays, setPays] = useState<Pay[]>([{ method: "CASH", amount: 0 }]);
  const [notes, setNotes] = useState("");
  const [error, setError] = useState("");
  const [done, setDone] = useState<null | { saleId: number; invoiceNo: string; total: number; change: number }>(null);
  const [held, setHeld] = useState<Held[]>([]);
  const [showHeld, setShowHeld] = useState(false);
  const [pending, start] = useTransition();
  const [jobCardId, setJobCardId] = useState<number | null>(preload?.jobCardId ?? null);
  const searchRef = useRef<HTMLDivElement>(null);
  const [notFound, setNotFound] = useState<string | null>(null);

  const bill = useMemo(() => calcBill(lines, billDiscount, interState), [lines, billDiscount, interState]);
  const paid = round2(pays.reduce((a, p) => a + (p.amount || 0), 0));
  const balance = round2(bill.total - paid);
  const change = paid > bill.total ? round2(paid - bill.total) : 0;

  useEffect(() => {
    listHeldBills().then(setHeld).catch(() => {});
  }, []);

  // Keyboard shortcuts: F2 search, F9 complete
  useEffect(() => {
    const h = (e: KeyboardEvent) => {
      if (e.key === "F2") {
        e.preventDefault();
        searchRef.current?.querySelector("input")?.focus();
      }
      if (e.key === "F9") {
        e.preventDefault();
        complete();
      }
    };
    window.addEventListener("keydown", h);
    return () => window.removeEventListener("keydown", h);
  });

  const add = (p: PickProduct) => {
    setError("");
    setNotFound(null);
    // functional update: several fast scans in a row must all count
    setLines((cur) => {
      const inCart = cur.filter((l) => l.productId === p.id).reduce((a, l) => a + l.qty, 0);
      if (inCart + 1 > p.stock) setError(`Only ${p.stock} of "${p.name}" in stock.`);
      const ix = cur.findIndex((l) => l.productId === p.id);
      if (ix >= 0) return cur.map((l, i) => (i === ix ? { ...l, qty: l.qty + 1 } : l));
      return [...cur, { productId: p.id, name: p.name + (p.size ? ` (${p.size})` : ""), hsn: p.hsn, qty: 1, unitPrice: p.sellingPrice, discount: 0, gstRate: p.gstRate, stock: p.stock }];
    });
    // ready for the next scan
    setTimeout(() => searchRef.current?.querySelector("input")?.focus(), 0);
  };

  // A scan while the cursor is outside the search box (e.g. after clicking a button) still adds the item
  useEffect(() => {
    const onScan = (e: Event) => {
      const code = String((e as CustomEvent<string>).detail).trim().toLowerCase();
      const p = products.find((x) => x.barcode?.toLowerCase() === code || x.sku.toLowerCase() === code);
      e.preventDefault();
      if (p) add(p);
      else setNotFound(code);
    };
    window.addEventListener("kpr-scan", onScan);
    return () => window.removeEventListener("kpr-scan", onScan);
  });
  const upd = (i: number, patch: Partial<Line>) => setLines(lines.map((l, j) => (j === i ? { ...l, ...patch } : l)));

  const reset = () => {
    setLines([]);
    setBillDiscount(0);
    setInterState(false);
    setCustomer(null);
    setVehicleId(null);
    setWalkInName("");
    setNewCust(null);
    setPays([{ method: "CASH", amount: 0 }]);
    setNotes("");
    setError("");
    setJobCardId(null);
  };

  const fillRemaining = (i: number) => {
    const others = pays.reduce((a, p, j) => (j === i ? a : a + (p.amount || 0)), 0);
    setPays(pays.map((p, j) => (j === i ? { ...p, amount: Math.max(0, round2(bill.total - others)) } : p)));
  };

  function complete() {
    if (pending || !lines.length) return;
    setError("");
    const effectivePays = paid === 0 && !customer && !newCust ? [{ method: pays[0].method, amount: bill.total }] : pays;
    start(async () => {
      const res = await createSale({
        lines: lines.map(({ stock: _s, ...l }) => l),
        billDiscount,
        interState,
        customerId: customer?.id ?? null,
        vehicleId,
        walkInName,
        newCustomer: !customer && newCust?.phone ? { name: newCust.name, phone: newCust.phone, whatsappOptIn: newCust.whatsappOptIn, vehicle: newCust.make ? { type: newCust.vType, make: newCust.make, model: newCust.model, regNo: newCust.regNo } : undefined } : null,
        payments: effectivePays,
        notes,
        jobCardId,
      });
      if (res.error) return setError(res.error);
      const paidNow = effectivePays.reduce((a, p) => a + (p.amount || 0), 0);
      setDone({ saleId: res.saleId!, invoiceNo: res.invoiceNo!, total: bill.total, change: paidNow > bill.total ? round2(paidNow - bill.total) : 0 });
      reset();
    });
  }

  const hold = () => {
    if (!lines.length) return;
    const label = customer?.name || newCust?.name || walkInName || `Bill at ${new Date().toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit" })}`;
    const data = JSON.stringify({ lines, billDiscount, interState, customer, vehicleId, walkInName, newCust, notes });
    start(async () => {
      setHeld(await holdBill(label, data));
      reset();
    });
  };
  const resume = (h: Held) => {
    const d = JSON.parse(h.data);
    setLines(d.lines ?? []);
    setBillDiscount(d.billDiscount ?? 0);
    setInterState(!!d.interState);
    setCustomer(d.customer ?? null);
    setVehicleId(d.vehicleId ?? null);
    setWalkInName(d.walkInName ?? "");
    setNewCust(d.newCust ?? null);
    setNotes(d.notes ?? "");
    setShowHeld(false);
    start(async () => setHeld(await deleteHeldBill(h.id)));
  };

  return (
    <div className="-mx-4 -my-5 flex min-h-[calc(100vh-56px)] flex-col sm:-mx-6 lg:-my-7 lg:min-h-screen xl:flex-row">
      {/* LEFT: items */}
      <div className="flex min-w-0 flex-1 flex-col p-4 sm:p-5">
        <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
          <h1 className="text-xl font-bold">POS Billing {jobCardId && <span className="badge ml-2 bg-sky-50 text-sky-700">Job {preload?.jobNumber}</span>}</h1>
          <div className="flex gap-2">
            <button className="btn-outline btn-sm" onClick={() => setShowHeld((v) => !v)}>Held bills ({held.length})</button>
            <button className="btn-outline btn-sm" onClick={hold} disabled={!lines.length || pending}>Hold bill</button>
            <button className="btn-ghost btn-sm" onClick={reset}>Clear</button>
          </div>
        </div>
        {showHeld && (
          <div className="card mb-3 p-2">
            {held.length === 0 && <p className="p-2 text-sm text-gray-500">No held bills.</p>}
            {held.map((h) => (
              <div key={h.id} className="flex items-center justify-between gap-2 rounded px-2 py-1.5 hover:bg-gray-50">
                <span className="text-sm">{h.label} <span className="text-xs text-gray-400">{new Date(h.createdAt).toLocaleTimeString("en-IN")}</span></span>
                <span className="flex gap-2">
                  <button className="btn-primary btn-sm" onClick={() => resume(h)}>Resume</button>
                  <button className="btn-ghost btn-sm" onClick={() => start(async () => setHeld(await deleteHeldBill(h.id)))}>Discard</button>
                </span>
              </div>
            ))}
          </div>
        )}
        <div ref={searchRef} className="mb-3">
          <ProductPicker products={products} onPick={add} onNotFound={(c) => setNotFound(c)} autoFocus placeholder="Scan barcode or search product (F2)…" />
          {notFound && (
            <div className="mt-2 flex flex-wrap items-center justify-between gap-2 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-900">
              <span>No product with barcode / code <b className="font-mono">{notFound}</b>.</span>
              <span className="flex gap-2">
                {canAddProduct && (
                  <a className="btn-dark btn-sm" href={`/products/new?barcode=${encodeURIComponent(notFound)}`} target="_blank">Add as new product</a>
                )}
                <button className="btn-ghost btn-sm" onClick={() => setNotFound(null)}>Dismiss</button>
              </span>
            </div>
          )}
        </div>

        <div className="card flex-1 overflow-hidden">
          <div className="overflow-x-auto">
            <table className="table">
              <thead>
                <tr><th>#</th><th>Item</th><th className="w-32">Qty</th><th className="w-28 text-right">Price</th><th className="w-24 text-right">Disc ₹</th><th className="text-right">GST</th><th className="text-right">Amount</th><th /></tr>
              </thead>
              <tbody>
                {lines.map((l, i) => (
                  <tr key={i}>
                    <td className="text-xs text-gray-400">{i + 1}</td>
                    <td>
                      {l.productId ? (
                        <span className="font-medium">{l.name}</span>
                      ) : (
                        <input className="input py-1" value={l.name} onChange={(e) => upd(i, { name: e.target.value })} />
                      )}
                      {l.productId && l.qty > l.stock && <div className="text-xs text-red-600">Only {l.stock} in stock</div>}
                    </td>
                    <td>
                      <div className="flex items-center gap-1">
                        <button className="btn-outline btn-sm px-2" onClick={() => upd(i, { qty: Math.max(1, l.qty - 1) })}>−</button>
                        <input type="number" min={1} className="input w-14 px-1 py-1 text-center" value={l.qty} onChange={(e) => upd(i, { qty: Math.max(0, Number(e.target.value)) })} />
                        <button className="btn-outline btn-sm px-2" onClick={() => upd(i, { qty: l.qty + 1 })}>+</button>
                      </div>
                    </td>
                    <td className="text-right">
                      {canEditPrice || !l.productId ? (
                        <input type="number" min={0} step="0.01" className="input px-1.5 py-1 text-right" value={l.unitPrice} onChange={(e) => upd(i, { unitPrice: Number(e.target.value) })} />
                      ) : (
                        <span className="tabular-nums">{money(l.unitPrice)}</span>
                      )}
                    </td>
                    <td><input type="number" min={0} step="1" className="input px-1.5 py-1 text-right" value={l.discount || ""} onChange={(e) => upd(i, { discount: Number(e.target.value) })} /></td>
                    <td className="text-right text-xs">
                      {l.productId ? `${l.gstRate}%` : (
                        <select className="input px-1 py-1" value={l.gstRate} onChange={(e) => upd(i, { gstRate: Number(e.target.value) })}>
                          {[0, 5, 12, 18, 28].map((r) => <option key={r} value={r}>{r}%</option>)}
                        </select>
                      )}
                    </td>
                    <td className="text-right font-semibold tabular-nums">{money(bill.lines[i]?.total ?? 0)}</td>
                    <td><button className="grid h-8 w-8 place-items-center rounded-md text-gray-400 hover:bg-red-50 hover:text-red-600" aria-label="Remove line" title="Remove line" onClick={() => setLines(lines.filter((_, j) => j !== i))}><Icon name="x" className="h-4 w-4" /></button></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {!lines.length && (
            <div className="p-10 text-center text-sm text-gray-400">
              Scan a barcode or search to add items.
              <div className="mt-1 text-xs">Shortcuts: <kbd>F2</kbd> search · <kbd>F9</kbd> complete sale</div>
            </div>
          )}
          <div className="border-t border-gray-100 p-3">
            <button className="btn-ghost btn-sm" onClick={() => setLines([...lines, { productId: null, name: "Fitting / labour charges", hsn: "9987", qty: 1, unitPrice: 0, discount: 0, gstRate: 18, stock: 0 }])}>
              + Add service / labour line
            </button>
          </div>
        </div>
      </div>

      {/* RIGHT: customer, totals, payment */}
      <aside className="w-full shrink-0 space-y-3 border-t border-gray-200 bg-white p-4 sm:p-5 xl:w-[400px] xl:border-l xl:border-t-0">
        <CustomerBox
          customer={customer}
          setCustomer={(c) => {
            setCustomer(c);
            setVehicleId(c?.vehicles[0]?.id ?? null);
            setNewCust(null);
          }}
          vehicleId={vehicleId}
          setVehicleId={setVehicleId}
          walkInName={walkInName}
          setWalkInName={setWalkInName}
          newCust={newCust}
          setNewCust={setNewCust}
        />

        <div className="rounded-xl bg-gray-50 p-3 text-sm">
          <div className="flex justify-between py-0.5"><span>Items total</span><span className="tabular-nums">{money(bill.subtotal)}</span></div>
          <div className="flex items-center justify-between py-0.5">
            <span>Bill discount ₹</span>
            <input type="number" min={0} className="input w-24 py-1 text-right" value={billDiscount || ""} onChange={(e) => setBillDiscount(Number(e.target.value))} />
          </div>
          {bill.discount > 0 && <div className="flex justify-between py-0.5 text-emerald-700"><span>Total discount</span><span className="tabular-nums">− {money(bill.discount)}</span></div>}
          <div className="flex justify-between py-0.5 text-gray-500"><span>Taxable value</span><span className="tabular-nums">{money(bill.taxableValue)}</span></div>
          {interState ? (
            <div className="flex justify-between py-0.5 text-gray-500"><span>IGST</span><span className="tabular-nums">{money(bill.igst)}</span></div>
          ) : (
            <>
              <div className="flex justify-between py-0.5 text-gray-500"><span>CGST</span><span className="tabular-nums">{money(bill.cgst)}</span></div>
              <div className="flex justify-between py-0.5 text-gray-500"><span>SGST</span><span className="tabular-nums">{money(bill.sgst)}</span></div>
            </>
          )}
          {bill.roundOff !== 0 && <div className="flex justify-between py-0.5 text-gray-500"><span>Round off</span><span className="tabular-nums">{bill.roundOff.toFixed(2)}</span></div>}
          <div className="mt-1 flex justify-between border-t border-gray-200 pt-2 text-2xl font-bold"><span>Total</span><span className="tabular-nums">{money(bill.total)}</span></div>
          <label className="mt-2 flex items-center gap-2 text-xs text-gray-500">
            <input type="checkbox" checked={interState} onChange={(e) => setInterState(e.target.checked)} /> Customer from outside {shopState} (IGST)
          </label>
        </div>

        <div>
          <div className="mb-1.5 flex items-center justify-between">
            <span className="label mb-0">Payment</span>
            <button className="text-xs font-medium text-link hover:underline" onClick={() => setPays([...pays, { method: "UPI", amount: 0 }])}>+ Split payment</button>
          </div>
          <div className="space-y-2">
            {pays.map((p, i) => (
              <div key={i} className="flex gap-1.5">
                <div className="flex rounded-lg border border-gray-300 p-0.5">
                  {METHODS.map((m) => (
                    <button key={m} className={`rounded-md px-2 py-1 text-xs font-semibold ${p.method === m ? "bg-gray-900 text-white" : "text-gray-600 hover:bg-gray-100"}`} onClick={() => setPays(pays.map((x, j) => (j === i ? { ...x, method: m } : x)))}>
                      {m}
                    </button>
                  ))}
                </div>
                <input type="number" min={0} className="input py-1 text-right" placeholder="Amount" value={p.amount || ""} onChange={(e) => setPays(pays.map((x, j) => (j === i ? { ...x, amount: Number(e.target.value) } : x)))} />
                <button className="btn-outline btn-sm" title="Fill remaining" onClick={() => fillRemaining(i)}>Full</button>
                {pays.length > 1 && <button className="grid h-9 w-9 place-items-center rounded-md text-gray-400 hover:bg-red-50 hover:text-red-600" aria-label="Remove payment" onClick={() => setPays(pays.filter((_, j) => j !== i))}><Icon name="x" className="h-4 w-4" /></button>}
              </div>
            ))}
          </div>
          <div className="mt-2 text-sm">
            {paid === 0 && lines.length > 0 && <p className="text-gray-500">Leave amount empty to take the full bill in {pays[0].method}.</p>}
            {paid > 0 && change > 0 && <p className="font-semibold text-emerald-700">Return change: {money(change)}</p>}
            {paid > 0 && balance > 0 && <p className="font-semibold text-amber-700">Balance on credit: {money(balance)} {!customer && !newCust && "(select a customer)"}</p>}
          </div>
        </div>

        <input className="input" placeholder="Bill note (optional)" value={notes} onChange={(e) => setNotes(e.target.value)} />

        {error && <div className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">{error}</div>}
        <button className="btn-primary w-full py-3 text-base" disabled={!lines.length || pending} onClick={complete}>
          {pending ? "Saving…" : `Complete sale  ${money(bill.total)}  (F9)`}
        </button>
      </aside>

      {done && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="card w-full max-w-sm p-6 text-center">
            <div className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-full bg-emerald-100 text-emerald-700"><Icon name="check" className="h-6 w-6" /></div>
            <h2 className="text-lg font-bold">Sale complete</h2>
            <p className="text-sm text-gray-500">Invoice {done.invoiceNo} · {money(done.total)}</p>
            {done.change > 0 && <p className="mt-2 text-lg font-bold text-emerald-700">Give change: {money(done.change)}</p>}
            <div className="mt-5 grid grid-cols-2 gap-2">
              <a className="btn-dark" href={`/print/invoice/${done.saleId}?size=80mm`} target="_blank">Print receipt</a>
              <a className="btn-outline" href={`/print/invoice/${done.saleId}?size=a4`} target="_blank">Print A4</a>
              <Link className="btn-outline" href={`/sales/${done.saleId}`}>View bill</Link>
              <button className="btn-primary" autoFocus onClick={() => setDone(null)}>New bill</button>
            </div>
            <div className="mt-2 flex justify-center">
              <WhatsAppButton kind="INVOICE" saleId={done.saleId} label="Send bill on WhatsApp" className="btn-outline w-full" />
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function CustomerBox({
  customer, setCustomer, vehicleId, setVehicleId, walkInName, setWalkInName, newCust, setNewCust,
}: {
  customer: Customer | null;
  setCustomer: (c: Customer | null) => void;
  vehicleId: number | null;
  setVehicleId: (v: number | null) => void;
  walkInName: string;
  setWalkInName: (s: string) => void;
  newCust: null | { name: string; phone: string; whatsappOptIn: boolean; vType: string; make: string; model: string; regNo: string };
  setNewCust: (c: null | { name: string; phone: string; whatsappOptIn: boolean; vType: string; make: string; model: string; regNo: string }) => void;
}) {
  const [q, setQ] = useState("");
  const [results, setResults] = useState<Customer[]>([]);
  useEffect(() => {
    if (q.trim().length < 2) {
      setResults([]);
      return;
    }
    const t = setTimeout(() => searchCustomers(q).then(setResults).catch(() => {}), 250);
    return () => clearTimeout(t);
  }, [q]);

  if (customer) {
    return (
      <div className="rounded-xl border border-gray-200 p-3">
        <div className="flex items-start justify-between">
          <div>
            <Link href={`/customers/${customer.id}`} target="_blank" className="font-semibold hover:underline">{customer.name}</Link>
            <div className="text-xs text-gray-500">{customer.phone}{customer.whatsappOptIn && <span className="ml-1 inline-flex items-center gap-0.5 font-medium text-emerald-700"><Icon name="chat" className="h-3 w-3" />WhatsApp</span>}</div>
          </div>
          <button className="text-xs text-gray-500 hover:text-red-600" onClick={() => setCustomer(null)}>Change</button>
        </div>
        {customer.vehicles.length > 0 && (
          <select className="input mt-2 py-1 text-sm" value={vehicleId ?? ""} onChange={(e) => setVehicleId(e.target.value ? Number(e.target.value) : null)}>
            <option value="">No vehicle</option>
            {customer.vehicles.map((v) => <option key={v.id} value={v.id}>{v.make} {v.model} {v.regNo ? `· ${v.regNo}` : ""}</option>)}
          </select>
        )}
      </div>
    );
  }

  if (newCust) {
    const set = (patch: Partial<typeof newCust>) => setNewCust({ ...newCust, ...patch });
    return (
      <div className="space-y-2 rounded-xl border border-gray-200 p-3">
        <div className="flex items-center justify-between">
          <span className="text-sm font-semibold">New customer</span>
          <button className="text-xs text-gray-500 hover:text-red-600" onClick={() => setNewCust(null)}>Cancel</button>
        </div>
        <div className="grid grid-cols-2 gap-2">
          <input className="input py-1" placeholder="Name" value={newCust.name} onChange={(e) => set({ name: e.target.value })} />
          <input className="input py-1" placeholder="Mobile *" value={newCust.phone} onChange={(e) => set({ phone: e.target.value })} />
          <select className="input py-1" value={newCust.vType} onChange={(e) => set({ vType: e.target.value })}><option value="BIKE">Bike</option><option value="CAR">Car</option></select>
          <input className="input py-1" placeholder="Make (Honda…)" value={newCust.make} onChange={(e) => set({ make: e.target.value })} />
          <input className="input py-1" placeholder="Model" value={newCust.model} onChange={(e) => set({ model: e.target.value })} />
          <input className="input py-1" placeholder="Reg. no." value={newCust.regNo} onChange={(e) => set({ regNo: e.target.value })} />
        </div>
        <label className="flex items-start gap-2 text-xs text-gray-600">
          <input type="checkbox" className="mt-0.5" checked={newCust.whatsappOptIn} onChange={(e) => set({ whatsappOptIn: e.target.checked })} />
          Customer agrees to receive offers & updates on WhatsApp
        </label>
      </div>
    );
  }

  return (
    <div className="relative rounded-xl border border-gray-200 p-3">
      <div className="mb-1.5 flex items-center justify-between">
        <span className="label mb-0">Customer</span>
        <button className="text-xs font-medium text-link hover:underline" onClick={() => setNewCust({ name: "", phone: q.match(/^\d+$/) ? q : "", whatsappOptIn: false, vType: "BIKE", make: "", model: "", regNo: "" })}>
          + New customer
        </button>
      </div>
      <input className="input py-1.5" placeholder="Search name, mobile or vehicle no." value={q} onChange={(e) => setQ(e.target.value)} />
      {results.length > 0 && (
        <ul className="absolute left-3 right-3 z-30 mt-1 max-h-64 overflow-y-auto rounded-lg border bg-white shadow-lg">
          {results.map((c) => (
            <li key={c.id}>
              <button className="w-full px-3 py-2 text-left text-sm hover:bg-gray-50" onClick={() => { setCustomer(c); setQ(""); setResults([]); }}>
                <span className="font-medium">{c.name}</span> <span className="text-xs text-gray-500">{c.phone}</span>
                {c.vehicles[0] && <div className="text-xs text-gray-500">{c.vehicles.map((v) => `${v.make} ${v.model ?? ""} ${v.regNo ?? ""}`).join(", ")}</div>}
              </button>
            </li>
          ))}
        </ul>
      )}
      <input className="input mt-2 py-1.5" placeholder="or walk-in name (optional)" value={walkInName} onChange={(e) => setWalkInName(e.target.value)} />
    </div>
  );
}
