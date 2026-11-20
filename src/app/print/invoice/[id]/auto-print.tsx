"use client";

import { useEffect } from "react";

/**
 * Prints the page once it has drawn (logo and barcode included).
 * - silent: opened by the server's silent-print window – close it when printing is done.
 * - frame: printed from a hidden frame inside the app – no buttons needed.
 */
export function AutoPrint({ silent = false, frame = false }: { silent?: boolean; frame?: boolean }) {
  useEffect(() => {
    const go = async () => {
      // Wait for images (shop logo) so they are not missing on paper
      await Promise.all(
        [...document.images].filter((i) => !i.complete).map((i) => new Promise((r) => { i.onload = i.onerror = r; })),
      );
      window.print();
    };
    const t = setTimeout(go, 350);
    if (!silent) return () => clearTimeout(t);
    const close = () => setTimeout(() => window.close(), 300);
    window.addEventListener("afterprint", close);
    const safety = setTimeout(() => window.close(), 15_000);
    return () => {
      clearTimeout(t);
      clearTimeout(safety);
      window.removeEventListener("afterprint", close);
    };
  }, [silent]);
  if (silent || frame) return null;
  return (
    <div className="no-print mb-3 flex justify-center gap-2 font-sans">
      <button className="btn-dark btn-sm" onClick={() => window.print()}>Print again</button>
      <button className="btn-outline btn-sm" onClick={() => window.close()}>Close</button>
    </div>
  );
}
