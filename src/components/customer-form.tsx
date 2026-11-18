"use client";

import { ActionForm, Submit } from "./forms";
import { saveCustomer } from "@/actions/customers";

type C = {
  id?: number; name?: string; phone?: string | null; altPhone?: string | null; email?: string | null; address?: string | null; gstin?: string | null;
  birthday?: string | null; tags?: string | null; notes?: string | null; openingBalance?: number; whatsappOptIn?: boolean;
};

export function CustomerForm({ c }: { c?: C }) {
  const isNew = !c?.id;
  return (
    <ActionForm action={saveCustomer} className="space-y-4">
      {isNew ? <input type="hidden" name="_new" value="1" /> : <input type="hidden" name="id" value={c!.id} />}
      <div className="grid gap-4 sm:grid-cols-2">
        <label><span className="label">Name *</span><input name="name" className="input" defaultValue={c?.name} required /></label>
        <label><span className="label">Mobile</span><input name="phone" className="input" defaultValue={c?.phone ?? ""} inputMode="tel" /></label>
        <label><span className="label">Alternate phone</span><input name="altPhone" className="input" defaultValue={c?.altPhone ?? ""} /></label>
        <label><span className="label">Email</span><input name="email" type="email" className="input" defaultValue={c?.email ?? ""} /></label>
        <label className="sm:col-span-2"><span className="label">Address</span><input name="address" className="input" defaultValue={c?.address ?? ""} /></label>
        <label><span className="label">GSTIN (business customers)</span><input name="gstin" className="input uppercase" defaultValue={c?.gstin ?? ""} maxLength={15} /></label>
        <label><span className="label">Birthday (MM-DD)</span><input name="birthday" className="input" defaultValue={c?.birthday ?? ""} placeholder="08-25" pattern="\d{2}-\d{2}" /></label>
        <label><span className="label">Tags (comma separated)</span><input name="tags" className="input" defaultValue={c?.tags ?? ""} placeholder="vip, mechanic, rider-club" /></label>
        <label><span className="label">Opening balance (customer owes)</span><input name="openingBalance" type="number" step="0.01" className="input" defaultValue={c?.openingBalance ?? 0} /></label>
        <label className="sm:col-span-2"><span className="label">Notes</span><textarea name="notes" rows={2} className="input" defaultValue={c?.notes ?? ""} /></label>
      </div>
      {isNew && (
        <fieldset className="rounded-lg border border-gray-200 p-3">
          <legend className="px-1 text-xs font-semibold text-gray-500">Vehicle (optional)</legend>
          <div className="grid gap-3 sm:grid-cols-5">
            <select name="v_type" className="input"><option value="BIKE">Bike</option><option value="CAR">Car</option></select>
            <input name="v_make" className="input" placeholder="Make (Royal Enfield)" />
            <input name="v_model" className="input" placeholder="Model (Classic 350)" />
            <input name="v_regNo" className="input uppercase" placeholder="Reg. no." />
            <input name="v_year" type="number" className="input" placeholder="Year" />
          </div>
        </fieldset>
      )}
      <label className="flex items-start gap-2 rounded-lg bg-emerald-50 p-3 text-sm text-emerald-900">
        <input type="checkbox" name="whatsappOptIn" defaultChecked={c?.whatsappOptIn} className="mt-0.5 h-4 w-4" />
        <span>
          <b>Customer agrees to receive offers & updates on WhatsApp.</b>
          <span className="block text-xs">Only tick this if the customer said yes. The date of consent is recorded.</span>
        </span>
      </label>
      <Submit>{isNew ? "Create customer" : "Save customer"}</Submit>
    </ActionForm>
  );
}
