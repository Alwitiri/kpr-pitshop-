"use client";

import { useEffect } from "react";

export function AutoPrint() {
  useEffect(() => {
    const t = setTimeout(() => window.print(), 400);
    return () => clearTimeout(t);
  }, []);
  return (
    <div className="no-print mb-3 flex justify-center gap-2 font-sans">
      <button className="btn-dark btn-sm" onClick={() => window.print()}>Print again</button>
      <button className="btn-outline btn-sm" onClick={() => window.close()}>Close</button>
    </div>
  );
}
