"use client";

import { ActionForm, Submit } from "./forms";
import { ymd } from "@/lib/format";

type Result = { ok?: string; error?: string } | null;

/** Generic "record a payment" form. Hidden fields carry ids (supplierId, purchaseId, saleId, customerId). */
export function PaymentForm({
  action,
  hidden,
  defaultAmount,
  submitLabel = "Record payment",
}: {
  action: (prev: Result, fd: FormData) => Promise<Result>;
  hidden: Record<string, string | number>;
  defaultAmount?: number;
  submitLabel?: string;
}) {
  return (
    <ActionForm action={action} resetOnSuccess className="space-y-3">
      {Object.entries(hidden).map(([k, v]) => <input key={k} type="hidden" name={k} value={v} />)}
      <div className="grid gap-3 sm:grid-cols-2">
        <label><span className="label">Amount (₹)</span><input name="amount" type="number" step="0.01" min="0.01" className="input" defaultValue={defaultAmount && defaultAmount > 0 ? defaultAmount.toFixed(2) : ""} required /></label>
        <label>
          <span className="label">Method</span>
          <select name="method" className="input">
            {["CASH", "UPI", "CARD", "BANK", "CHEQUE"].map((m) => <option key={m}>{m}</option>)}
          </select>
        </label>
        <label><span className="label">Date</span><input name="date" type="date" className="input" defaultValue={ymd()} /></label>
        <label><span className="label">Reference (UTR / cheque no.)</span><input name="reference" className="input" /></label>
      </div>
      <label className="block"><span className="label">Note</span><input name="note" className="input" /></label>
      <Submit>{submitLabel}</Submit>
    </ActionForm>
  );
}
