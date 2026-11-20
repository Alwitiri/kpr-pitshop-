"use client";

import { useEffect, useState } from "react";
import { previewTemplate } from "@/actions/whatsapp";
import { WaBubble } from "@/components/wa-text";

type Option = { name: string; language: string; params: number; category: string; body: string };

/** One editable message with a live WhatsApp-style preview, plus its approved template for automatic mode. */
export function TemplateField({
  kind, label, hint, value, defaultValue, cloud,
}: {
  kind: string;
  label: string;
  hint: string;
  value: string;
  defaultValue: string;
  cloud: { template: string; lang: string; params: string; suggested: string; options: Option[] };
}) {
  const [text, setText] = useState(value);
  const [preview, setPreview] = useState("");
  const [tpl, setTpl] = useState(cloud.template ? `${cloud.template}|${cloud.lang}` : "");
  const [params, setParams] = useState(cloud.params);
  useEffect(() => {
    const t = setTimeout(() => previewTemplate(text).then(setPreview).catch(() => setPreview(text)), 350);
    return () => clearTimeout(t);
  }, [text]);
  const changed = text.trim() !== defaultValue;
  const [tName, tLang] = tpl.split("|");
  const chosen = cloud.options.find((o) => o.name === tName && o.language === tLang);
  const count = params.split(",").filter((p) => p.trim()).length;
  const known = cloud.options.length > 0 || !!cloud.template;

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
        <textarea name={`t_${kind}`} rows={6} className="input" value={text} onChange={(e) => setText(e.target.value)} />
      </label>
      <div className="space-y-3">
        <div>
          <span className="label">Preview</span>
          <WaBubble text={preview || text} />
        </div>
        <div className="rounded-lg border border-dashed border-gray-300 p-2.5">
          <div className="mb-1.5 text-xs font-semibold text-gray-700">Automatic mode – approved template</div>
          {/* hidden fields carry the choice to the form */}
          <input type="hidden" name={`ct_${kind}`} value={tName ?? ""} />
          <input type="hidden" name={`cl_${kind}`} value={tLang ?? ""} />
          {known ? (
            <select
              className="input text-sm"
              value={tpl}
              onChange={(e) => {
                setTpl(e.target.value);
                if (e.target.value && !params) setParams(cloud.suggested);
              }}
              aria-label={`Approved template for ${label}`}
            >
              <option value="">None – send the wording above as text (24-hour window only)</option>
              {cloud.template && !cloud.options.some((o) => o.name === cloud.template && o.language === cloud.lang) && (
                <option value={`${cloud.template}|${cloud.lang}`}>{cloud.template} ({cloud.lang}) – saved earlier</option>
              )}
              {cloud.options.map((o) => (
                <option key={`${o.name}|${o.language}`} value={`${o.name}|${o.language}`}>
                  {o.name} ({o.language}) · {o.category.toLowerCase()} · {o.params} fill-in{o.params === 1 ? "" : "s"}
                </option>
              ))}
            </select>
          ) : (
            <p className="text-xs text-gray-500">Load the approved templates (right side) to choose one.</p>
          )}
          {tpl && (
            <label className="mt-2 block">
              <span className="text-xs text-gray-600">Fill-ins for {"{{1}}"}, {"{{2}}"}… in order (comma separated)</span>
              <input name={`cp_${kind}`} className="input mt-1 font-mono text-sm" value={params} onChange={(e) => setParams(e.target.value)} placeholder={cloud.suggested} />
              {chosen && count !== chosen.params && (
                <span className="mt-1 block text-xs font-medium text-amber-700">This template needs {chosen.params} fill-in{chosen.params === 1 ? "" : "s"}; you have {count}.</span>
              )}
              {chosen?.body && <span className="mt-1 block text-xs text-gray-500">Template: “{chosen.body}”</span>}
            </label>
          )}
          {!tpl && <input type="hidden" name={`cp_${kind}`} value="" />}
        </div>
      </div>
    </div>
  );
}
