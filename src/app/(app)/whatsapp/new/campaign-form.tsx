"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import { ActionForm, Submit } from "@/components/forms";
import { createCampaign, previewAudience, previewTemplate } from "@/actions/whatsapp";
import { WaText } from "@/components/wa-text";
import { WA_PLACEHOLDERS } from "@/lib/wa-templates";

export function CampaignForm({ defaultBody, segments }: { defaultBody: string; segments: [string, string][] }) {
  const ref = useRef<HTMLDivElement>(null);
  const [aud, setAud] = useState<{ count: number; sample: string[] } | null>(null);
  const [, start] = useTransition();
  const [body, setBody] = useState(defaultBody);

  const refresh = () => {
    const form = ref.current?.closest("form");
    if (!form) return;
    const fd = new FormData(form);
    start(async () => setAud(await previewAudience(fd)));
  };
  useEffect(refresh, []);
  // Live preview with sample data (shop name, customer…) – debounced while typing
  const [preview, setPreview] = useState("");
  useEffect(() => {
    const t = setTimeout(() => previewTemplate(body).then(setPreview).catch(() => setPreview(body)), 300);
    return () => clearTimeout(t);
  }, [body]);

  return (
    <ActionForm action={createCampaign} className="grid gap-5 xl:grid-cols-[1fr_380px]">
      <div className="card space-y-4 p-4 sm:p-5" ref={ref}>
        <label className="block">
          <span className="label">Offer name (for you) *</span>
          <input name="name" className="input" placeholder="e.g. Diwali helmet offer" required />
        </label>
        <fieldset onChange={refresh} className="rounded-lg border border-gray-200 p-3">
          <legend className="px-1 text-xs font-semibold text-gray-600">Who gets it</legend>
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            <label><span className="label">Segment</span>
              <select name="segment" className="input" defaultValue="">
                <option value="">Any</option>
                {segments.map(([k, l]) => <option key={k} value={k}>{l}</option>)}
              </select>
            </label>
            <label><span className="label">Vehicle</span>
              <select name="vtype" className="input" defaultValue=""><option value="">Any</option><option value="BIKE">Bike owners</option><option value="CAR">Car owners</option></select>
            </label>
            <label><span className="label">Make</span><input name="make" className="input" placeholder="Royal Enfield" onBlur={refresh} /></label>
            <label><span className="label">Tag</span><input name="tag" className="input" placeholder="rider-club" onBlur={refresh} /></label>
            <label><span className="label">Not visited for</span>
              <select name="inactive" className="input" defaultValue=""><option value="">—</option><option value="30">30+ days</option><option value="60">60+ days</option><option value="90">90+ days</option><option value="180">180+ days</option></select>
            </label>
          </div>
        </fieldset>
        <label className="block">
          <span className="label">Message *</span>
          <textarea name="body" rows={9} className="input font-[inherit]" value={body} onChange={(e) => setBody(e.target.value)} required />
          <span className="mt-1 block text-xs text-gray-500">
            {"{customer}"} becomes each customer&apos;s name. *Stars* make text bold in WhatsApp. Keep “Reply STOP” so people can opt out.
          </span>
        </label>
        <details className="text-xs text-gray-600">
          <summary className="cursor-pointer font-medium text-link">All placeholders</summary>
          <ul className="mt-2 grid gap-1 sm:grid-cols-2">{WA_PLACEHOLDERS.map(([k, d]) => <li key={k}><code className="kbd">{k}</code> {d}</li>)}</ul>
        </details>
      </div>
      <div className="space-y-4">
        <div className="card p-4 sm:p-5">
          <div className="text-xs font-semibold uppercase tracking-wide text-gray-600">Will go to</div>
          <div className="mt-1 text-3xl font-bold tabular-nums text-gray-950">{aud ? aud.count : "…"}</div>
          <div className="text-sm text-gray-600">opted-in customers</div>
          {aud && aud.sample.length > 0 && <p className="mt-2 text-xs text-gray-500">{aud.sample.join(", ")}{aud.count > aud.sample.length ? ` and ${aud.count - aud.sample.length} more` : ""}</p>}
          <Submit className="btn-primary mt-4 w-full">Create send list</Submit>
          <p className="mt-2 text-xs text-gray-500">Next, you open each chat with one click and press Send in WhatsApp.</p>
        </div>
        <div className="card p-4 sm:p-5">
          <div className="mb-2 text-xs font-semibold uppercase tracking-wide text-gray-600">Preview</div>
          <div className="whitespace-pre-wrap rounded-lg rounded-tl-none bg-[#dcf8c6] p-3 text-sm text-gray-900 shadow-sm">
            <WaText text={preview || body} />
          </div>
        </div>
      </div>
    </ActionForm>
  );
}
