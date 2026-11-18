"use client";

import { useEffect, useRef } from "react";
import JsBarcode from "jsbarcode";

export function Barcode({ value, height = 40, width = 1.6, fontSize = 12, displayValue = true }: { value: string; height?: number; width?: number; fontSize?: number; displayValue?: boolean }) {
  const ref = useRef<SVGSVGElement>(null);
  useEffect(() => {
    if (!ref.current || !value) return;
    try {
      JsBarcode(ref.current, value, { format: "CODE128", height, width, fontSize, margin: 2, displayValue });
    } catch {
      /* invalid characters */
    }
  }, [value, height, width, fontSize, displayValue]);
  return <svg ref={ref} />;
}
