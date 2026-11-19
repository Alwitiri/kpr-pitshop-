// Barcode helpers shared by the browser and the server.
//
// KPR generates EAN-13 codes in the "in-store" range (starting with 2), the
// standard range shops use for their own labels. They never clash with
// manufacturer barcodes (which start with 0, 1, 3–9, e.g. 890 for India).

/** EAN-13 check digit for the first 12 digits. */
export function ean13CheckDigit(first12: string) {
  let sum = 0;
  for (let i = 0; i < 12; i++) sum += Number(first12[i]) * (i % 2 === 0 ? 1 : 3);
  return String((10 - (sum % 10)) % 10);
}

export function isValidEan13(code: string) {
  return /^\d{13}$/.test(code) && ean13CheckDigit(code.slice(0, 12)) === code[12];
}

/** In-store EAN-13: "21" + 10-digit running number + check digit. */
export function makeStoreEan13(seq: number) {
  const first12 = "21" + String(seq).padStart(10, "0");
  return first12 + ean13CheckDigit(first12);
}

/** Which symbology to draw: EAN-13 when valid (what retail scanners love), else Code 128 (any text). */
export function barcodeFormat(code: string): "EAN13" | "CODE128" {
  return isValidEan13(code) ? "EAN13" : "CODE128";
}

/** Normalise what a scanner typed (scanners may add spaces / lowercase SKUs). */
export const cleanCode = (s: string) => s.trim().replace(/\s+/g, "");
