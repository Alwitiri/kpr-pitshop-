"use client";

import { useEffect, useState } from "react";
import { previewTemplate } from "@/actions/whatsapp";
import { WaBubble } from "@/components/wa-text";

/** One editable message with a live WhatsApp-style preview using sample data. */
export function TemplateField({ name, label, hint, value, defaultValue }: { name: string; label: string; hint: string; value: string; defaultValue: string }) {
  const [text, setText] = useState(value);
  const [preview, setPreview] = useState("");
  useEffect(() => {
    const t = setTimeout(() => previewTemplate(text).then(setPreview).catch(() => setPreview(text)), 350);
    return () => clearTimeout(t);
  }, [text]);
  const changed = text.trim() !== defaultValue;
  return (
    <div className="grid gap-3 border-b border-gray-100 pb-6 last:border-0 last:pb-0 lg:grid-cols-2">
      <label className="block">
        <span className="flex items-center justify-between gap-2">
          <span className="label mb-0">{label}</span>
          {changed && (
            <button type="button" className="text-xs font-medium text-link hover:underline" onClick={() => setText(defaultValue)}>
              Reset to default
            </button>
          )}
        </span>
        <span className="mb-1 block text-xs text-gray-500">{hint}</span>
        <textarea name={name} rows={6} className="input" value={text} onChange={(e) => setText(e.target.value)} />
      </label>
      <div>
        <span className="label">Preview</span>
        <WaBubble text={preview || text} />
      </div>
    </div>
  );
}
