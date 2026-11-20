"use client";

import { useState, useTransition } from "react";
import { ActionForm, Submit } from "@/components/forms";
import { savePrintSettings, testReceiptPrint } from "@/actions/printing";
import { printInFrame } from "@/components/receipt-print";

export function PrintSettings({ receiptWidth, silentPrint, receiptAutoPrint, edge }: { receiptWidth: string; silentPrint: boolean; receiptAutoPrint: boolean; edge: boolean }) {
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const [pending, start] = useTransition();
  return (
    <div className="space-y-4">
      <ActionForm action={savePrintSettings} className="space-y-4">
        <fieldset>
          <legend className="label">Receipt paper (thermal printer)</legend>
          <div className="grid grid-cols-2 gap-2">
            {[["80mm", "80 mm", "Standard counter printer"], ["58mm", "58 mm", "Small / portable printer"]].map(([v, l, d]) => (
              <label key={v} className="flex cursor-pointer items-start gap-2 rounded-lg border border-gray-200 p-2.5 has-[:checked]:border-brand-500 has-[:checked]:bg-brand-50/50">
                <input type="radio" name="receiptWidth" value={v} defaultChecked={receiptWidth === v} className="mt-0.5 h-4 w-4" />
                <span><span className="block text-sm font-semibold">{l}</span><span className="block text-xs text-gray-600">{d}</span></span>
              </label>
            ))}
          </div>
        </fieldset>
        <label className="flex items-start gap-3 text-sm">
          <input type="checkbox" name="silentPrint" defaultChecked={silentPrint} className="mt-0.5 h-4 w-4" />
          <span>
            <b>Silent printing</b> – receipts print straight away, without the print window
            <span className="block text-xs text-gray-600">
              On the shop PC, receipts go to the <b>Windows default printer</b>, so set the receipt printer as default (Windows Settings → Printers).
              A4 invoices and barcode stickers still show the print window, so you can pick another printer. Other devices on the shop Wi-Fi keep the print window.
            </span>
            {!edge && <span className="mt-1 block text-xs font-medium text-amber-700">Microsoft Edge was not found on this PC – silent printing needs it.</span>}
          </span>
        </label>
        <label className="flex items-start gap-3 text-sm">
          <input type="checkbox" name="receiptAutoPrint" defaultChecked={receiptAutoPrint} className="mt-0.5 h-4 w-4" />
          <span>
            <b>Print the receipt automatically after every sale</b>
            <span className="block text-xs text-gray-600">No need to press “Print receipt”. Works best with silent printing on.</span>
          </span>
        </label>
        <Submit>Save printing settings</Submit>
      </ActionForm>
      <div className="border-t border-gray-100 pt-3">
        <button
          type="button"
          className="btn-outline btn-sm"
          disabled={pending}
          onClick={() =>
            start(async () => {
              const r = await testReceiptPrint();
              if (r.error) return setMsg({ ok: false, text: r.error });
              if (r.mode === "dialog" && r.saleId) printInFrame(`/print/invoice/${r.saleId}?size=receipt`);
              setMsg({ ok: true, text: r.mode === "silent" ? "Sent the latest receipt to the default printer." : r.note ?? "Opened the print window with the latest receipt." });
            })
          }
        >
          {pending ? "Printing…" : "Test print (latest receipt)"}
        </button>
        <span className="ml-2 text-xs text-gray-500">Save first – the test uses the saved settings.</span>
        {msg && <p role="status" className={`mt-2 text-xs ${msg.ok ? "text-emerald-700" : "text-red-700"}`}>{msg.text}</p>}
      </div>
    </div>
  );
}
