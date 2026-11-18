"use client";

import { ActionForm, Submit } from "./forms";
import { saveSupplier } from "@/actions/purchases";

type S = {
  id?: number; name?: string; contactPerson?: string | null; phone?: string | null; email?: string | null; gstin?: string | null;
  address?: string | null; openingBalance?: number; notes?: string | null; active?: boolean;
};

export function SupplierForm({ s }: { s?: S }) {
  return (
    <ActionForm action={saveSupplier} className="space-y-4">
      {s?.id ? <input type="hidden" name="id" value={s.id} /> : <input type="hidden" name="_new" value="1" />}
      <div className="grid gap-4 sm:grid-cols-2">
        <label className="sm:col-span-2"><span className="label">Supplier / firm name *</span><input name="name" className="input" defaultValue={s?.name} required /></label>
        <label><span className="label">Contact person</span><input name="contactPerson" className="input" defaultValue={s?.contactPerson ?? ""} /></label>
        <label><span className="label">Phone</span><input name="phone" className="input" defaultValue={s?.phone ?? ""} /></label>
        <label><span className="label">Email</span><input name="email" type="email" className="input" defaultValue={s?.email ?? ""} /></label>
        <label><span className="label">GSTIN</span><input name="gstin" className="input uppercase" defaultValue={s?.gstin ?? ""} maxLength={15} /></label>
        <label className="sm:col-span-2"><span className="label">Address</span><textarea name="address" rows={2} className="input" defaultValue={s?.address ?? ""} /></label>
        <label><span className="label">Opening balance (we owe)</span><input name="openingBalance" type="number" step="0.01" className="input" defaultValue={s?.openingBalance ?? 0} /></label>
        <label><span className="label">Notes</span><input name="notes" className="input" defaultValue={s?.notes ?? ""} /></label>
      </div>
      {s?.id && (
        <label className="inline-flex items-center gap-2 text-sm"><input type="checkbox" name="active" defaultChecked={s.active} className="h-4 w-4" /> Active</label>
      )}
      <div><Submit>{s?.id ? "Save supplier" : "Create supplier"}</Submit></div>
    </ActionForm>
  );
}
