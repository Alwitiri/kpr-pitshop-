"use client";

import { useEffect, useRef } from "react";
import JsBarcode from "jsbarcode";
import { barcodeFormat } from "@/lib/barcode";

/**
 * Draws a barcode as SVG: EAN-13 for valid 13-digit codes, Code 128 for anything else.
 * `fit` makes the SVG scale to its container (used on stickers measured in mm).
 */
export function Barcode({
  value,
  height = 40,
  width = 1.6,
  fontSize = 12,
  displayValue = true,
  fit = false,
  className,
}: {
  value: string;
  height?: number;
  width?: number;
  fontSize?: number;
  displayValue?: boolean;
  fit?: boolean;
  className?: string;
}) {
  const ref = useRef<SVGSVGElement>(null);
  useEffect(() => {
    const svg = ref.current;
    if (!svg || !value) return;
    const opts = { height, width, fontSize, margin: fit ? 0 : 2, displayValue, flat: true, textMargin: 0 };
    try {
      JsBarcode(svg, value, { ...opts, format: barcodeFormat(value) });
    } catch {
      try {
        JsBarcode(svg, value, { ...opts, format: "CODE128" });
      } catch {
        return; /* unprintable characters */
      }
    }
    if (fit) {
      const w = svg.getAttribute("width")?.replace("px", "");
      const h = svg.getAttribute("height")?.replace("px", "");
      if (w && h) {
        svg.setAttribute("viewBox", `0 0 ${w} ${h}`);
        svg.setAttribute("preserveAspectRatio", "xMidYMid meet");
        svg.removeAttribute("width");
        svg.removeAttribute("height");
      }
    }
  }, [value, height, width, fontSize, displayValue, fit]);
  return <svg ref={ref} className={className} />;
}
