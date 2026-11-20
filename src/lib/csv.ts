/** Minimal CSV parser (quotes, commas and new lines inside quotes) for Excel "CSV UTF-8" files. */
export function parseCsv(text: string): string[][] {
  const rows: string[][] = [];
  let row: string[] = [], cell = "", q = false;
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (q) {
      if (c === '"' && text[i + 1] === '"') { cell += '"'; i++; }
      else if (c === '"') q = false;
      else cell += c;
    } else if (c === '"') q = true;
    else if (c === ",") { row.push(cell); cell = ""; }
    else if (c === "\n" || c === "\r") {
      if (c === "\r" && text[i + 1] === "\n") i++;
      row.push(cell); cell = "";
      if (row.some((x) => x.trim())) rows.push(row);
      row = [];
    } else cell += c;
  }
  row.push(cell);
  if (row.some((x) => x.trim())) rows.push(row);
  return rows;
}

/** Header → column helper: col(row, "name") */
export function columns(header: string[]) {
  const h = header.map((x) => x.trim().toLowerCase().replace(/[\s-]+/g, "_"));
  return {
    has: (k: string) => h.includes(k),
    col: (r: string[], k: string) => {
      const i = h.indexOf(k);
      return i >= 0 ? (r[i] ?? "").trim() : "";
    },
  };
}
