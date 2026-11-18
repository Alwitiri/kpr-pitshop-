"use client";

import { useEffect, useState } from "react";
import { ActionForm, Submit } from "@/components/forms";
import { createJobCard } from "@/actions/jobcards";
import { searchCustomers } from "@/actions/sales";

type V = { id: number; make: string; model: string | null; regNo: string | null };
type C = { id: number; name: string; phone: string | null; vehicles: V[] };

export function NewJobForm({ techs, initialCustomer }: { techs: { id: number; name: string }[]; initialCustomer: C | null }) {
  const [customer, setCustomer] = useState<C | null>(initialCustomer);
  const [q, setQ] = useState("");
  const [results, setResults] = useState<C[]>([]);
  const [vehicleId, setVehicleId] = useState<string>(initialCustomer?.vehicles[0]?.id.toString() ?? "");

  useEffect(() => {
    if (q.trim().length < 2) return setResults([]);
    const t = setTimeout(() => searchCustomers(q).then(setResults).catch(() => {}), 250);
    return () => clearTimeout(t);
  }, [q]);

  return (
    <ActionForm action={createJobCard} className="grid gap-5 lg:grid-cols-2">
      <section className="card card-pad space-y-4">
        <h2 className="text-sm font-semibold">Customer & vehicle</h2>
        {customer ? (
          <>
            <input type="hidden" name="customerId" value={customer.id} />
            <div className="flex items-center justify-between rounded-lg bg-gray-50 p-3">
              <div><div className="font-semibold">{customer.name}</div><div className="text-xs text-gray-500">{customer.phone}</div></div>
              <button type="button" className="text-xs text-gray-500 hover:text-red-600" onClick={() => setCustomer(null)}>Change</button>
            </div>
            <label className="block">
              <span className="label">Vehicle</span>
              <select name="vehicleId" className="input" value={vehicleId} onChange={(e) => setVehicleId(e.target.value)}>
                <option value="">New vehicle (enter below)</option>
                {customer.vehicles.map((v) => <option key={v.id} value={v.id}>{v.make} {v.model} {v.regNo ?? ""}</option>)}
              </select>
            </label>
          </>
        ) : (
          <div className="relative space-y-3">
            <input className="input" placeholder="Search existing customer (name / mobile / vehicle no.)" value={q} onChange={(e) => setQ(e.target.value)} />
            {results.length > 0 && (
              <ul className="absolute z-20 w-full rounded-lg border bg-white shadow-lg">
                {results.map((c) => (
                  <li key={c.id}><button type="button" className="w-full px-3 py-2 text-left text-sm hover:bg-gray-50" onClick={() => { setCustomer(c); setVehicleId(c.vehicles[0]?.id.toString() ?? ""); setQ(""); setResults([]); }}>{c.name} <span className="text-xs text-gray-500">{c.phone}</span></button></li>
                ))}
              </ul>
            )}
            <p className="text-xs text-gray-500">…or new customer:</p>
            <div className="grid grid-cols-2 gap-3">
              <input name="c_name" className="input" placeholder="Name" />
              <input name="c_phone" className="input" placeholder="Mobile" />
            </div>
          </div>
        )}
        {(!customer || !vehicleId) && (
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            <select name="v_type" className="input"><option value="BIKE">Bike</option><option value="CAR">Car</option></select>
            <input name="v_make" className="input" placeholder="Make" />
            <input name="v_model" className="input" placeholder="Model" />
            <input name="v_regNo" className="input uppercase" placeholder="Reg. no." />
          </div>
        )}
        <label className="block"><span className="label">Odometer (km)</span><input name="odometer" type="number" className="input" /></label>
      </section>
      <section className="card card-pad space-y-4">
        <h2 className="text-sm font-semibold">Work</h2>
        <label className="block"><span className="label">Work required / complaint *</span><textarea name="complaint" rows={4} className="input" required placeholder="e.g. Fit crash guard and fog lamps; check horn wiring" /></label>
        <div className="grid grid-cols-2 gap-3">
          <label>
            <span className="label">Technician</span>
            <select name="technicianId" className="input"><option value="">Unassigned</option>{techs.map((t) => <option key={t.id} value={t.id}>{t.name}</option>)}</select>
          </label>
          <label><span className="label">Promised delivery</span><input name="promisedAt" type="datetime-local" className="input" /></label>
          <label><span className="label">Labour charge (₹, incl. GST)</span><input name="labourCharge" type="number" step="1" min="0" className="input" defaultValue={0} /></label>
          <label><span className="label">Estimate given (₹)</span><input name="estimate" type="number" step="1" min="0" className="input" defaultValue={0} /></label>
        </div>
        <Submit>Create job card</Submit>
      </section>
    </ActionForm>
  );
}
