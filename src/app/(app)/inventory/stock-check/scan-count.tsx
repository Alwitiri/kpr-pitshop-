"use client";

import { useState } from "react";

/**
 * Count stock by scanning: every scan adds 1 to that product's "Counted" box.
 * Codes map to product ids; rows are found by their input name "count_<id>".
 */
export function ScanCount({ codes }: { codes: Record<string, number> }) {
  const [v, setV] = useState("");
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const [scans, setScans] = useState(0);

  const scan = (raw: string) => {
    const id = codes[raw.trim().toLowerCase()];
    const input = id ? (document.querySelector(`input[name="count_${id}"]`) as HTMLInputElement | null) : null;
    if (!input) {
      setMsg({ ok: false, text: `"${raw}" is not in this list (check the category / rack filter).` });
      return;
    }
    input.value = String((Number(input.value) || 0) + 1);
    const row = input.closest("tr");
    row?.scrollIntoView({ block: "center", behavior: "smooth" });
    row?.classList.add("bg-emerald-50");
    setTimeout(() => row?.classList.remove("bg-emerald-50"), 900);
    setScans((n) => n + 1);
    const name = row?.querySelector("td:nth-child(2)")?.textContent ?? "";
    setMsg({ ok: true, text: `${name.trim()} → counted ${input.value}` });
  };

  return (
    <div className="card mb-4 p-3 no-print">
      <div className="flex flex-wrap items-end gap-3">
        <label className="min-w-72 flex-1">
          <span className="label">Count by scanning – scan every piece on the shelf</span>
          <input
            className="input font-mono"
            value={v}
            autoFocus
            placeholder="Click here, then scan items one by one"
            onChange={(e) => setV(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                e.preventDefault();
                scan(e.currentTarget.value);
                setV("");
              }
            }}
          />
        </label>
        <span className="text-sm text-gray-500">{scans} scans</span>
      </div>
      {msg && <p className={`mt-2 text-sm ${msg.ok ? "text-emerald-700" : "text-red-600"}`}>{msg.text}</p>}
    </div>
  );
}
