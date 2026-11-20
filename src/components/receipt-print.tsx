"use client";

import { useState, useTransition } from "react";
import { printReceipt } from "@/actions/printing";

/** Prints a page in a hidden frame (the page prints itself), so no extra tab stays open. */
export function printInFrame(url: string) {
  const f = document.createElement("iframe");
  f.setAttribute("aria-hidden", "true");
  f.style.cssText = "position:fixed;right:0;bottom:0;width:0;height:0;border:0;opacity:0;pointer-events:none";
  f.src = url + (url.includes("?") ? "&" : "?") + "frame=1";
  document.body.appendChild(f);
  setTimeout(() => f.remove(), 120_000);
}

/** Receipt for a bill: silent on the shop PC when switched on, otherwise the normal print window. */
export async function runReceiptPrint(saleId: number): Promise<string | null> {
  const r = await printReceipt(saleId);
  if (r.error) return r.error;
  if (r.mode === "silent") return "Sent to the receipt printer.";
  printInFrame(`/print/invoice/${saleId}?size=receipt`);
  return r.note ?? null;
}

export function ReceiptButton({ saleId, label = "Print receipt", className = "btn-outline" }: { saleId: number; label?: string; className?: string }) {
  const [note, setNote] = useState<string | null>(null);
  const [pending, start] = useTransition();
  return (
    <span className="relative inline-flex">
      <button
        type="button"
        className={className}
        disabled={pending}
        onClick={() =>
          start(async () => {
            const n = await runReceiptPrint(saleId);
            setNote(n);
            if (n) setTimeout(() => setNote(null), 5000);
          })
        }
      >
        {pending ? "Printing…" : label}
      </button>
      {note && (
        <span role="status" className="page-enter absolute left-0 top-full z-30 mt-1 w-max max-w-[260px] rounded-md bg-gray-900 px-2 py-1 text-xs text-white shadow">
          {note}
        </span>
      )}
    </span>
  );
}
