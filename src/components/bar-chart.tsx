"use client";

import { useState } from "react";

export type Bar = { label: string; value: number; tip?: string };

const SERIES = "#2a78d6"; // categorical slot 1 (validated default palette)

/** Single-series column chart: thin rounded bars, recessive axis, hover tooltip. */
export function BarChart({
  data,
  height = 180,
  format = (n: number) => `₹${Math.round(n).toLocaleString("en-IN")}`,
  labelEvery,
}: {
  data: Bar[];
  height?: number;
  format?: (n: number) => string;
  labelEvery?: number;
}) {
  const [hover, setHover] = useState<number | null>(null);
  const max = Math.max(1, ...data.map((d) => d.value));
  const nice = niceMax(max);
  const every = labelEvery ?? Math.max(1, Math.ceil(data.length / 10));

  return (
    <div className="relative select-none">
      <div className="flex">
        <div className="flex w-14 shrink-0 flex-col justify-between pr-2 text-right text-[10px] text-gray-400" style={{ height }}>
          <span>{format(nice)}</span>
          <span>{format(nice / 2)}</span>
          <span>0</span>
        </div>
        <div className="relative flex-1" style={{ height }}>
          {/* gridlines */}
          <div className="absolute inset-x-0 top-0 border-t border-dashed border-gray-200" />
          <div className="absolute inset-x-0 top-1/2 border-t border-dashed border-gray-200" />
          <div className="absolute inset-x-0 bottom-0 border-t border-gray-300" />
          <div className="absolute inset-0 flex items-end gap-[2px]">
            {data.map((d, i) => (
              <div
                key={i}
                className="relative flex h-full flex-1 items-end justify-center"
                onMouseEnter={() => setHover(i)}
                onMouseLeave={() => setHover(null)}
              >
                <div
                  className="w-full max-w-7 rounded-t-[4px] transition-opacity"
                  style={{ height: `${(d.value / nice) * 100}%`, minHeight: d.value > 0 ? 2 : 0, background: SERIES, opacity: hover === null || hover === i ? 1 : 0.45 }}
                />
                {hover === i && (
                  <div className="pointer-events-none absolute bottom-full z-10 mb-1 whitespace-nowrap rounded-md bg-gray-900 px-2 py-1 text-xs text-white shadow">
                    <div className="font-semibold">{format(d.value)}</div>
                    <div className="text-gray-300">{d.tip ?? d.label}</div>
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      </div>
      <div className="ml-14 mt-1 flex gap-[2px]">
        {data.map((d, i) => (
          <div key={i} className="flex-1 truncate text-center text-[10px] text-gray-500">{i % every === 0 ? d.label : ""}</div>
        ))}
      </div>
    </div>
  );
}

function niceMax(n: number) {
  const p = Math.pow(10, Math.floor(Math.log10(n)));
  const m = n / p;
  const step = m <= 1 ? 1 : m <= 2 ? 2 : m <= 5 ? 5 : 10;
  return step * p;
}
