import "server-only";
import { spawn } from "node:child_process";
import { existsSync, mkdirSync } from "node:fs";
import os from "node:os";
import path from "node:path";

/**
 * Silent receipt printing on the shop PC.
 *
 * The server opens the receipt in a small, off-screen Microsoft Edge window that uses its own
 * profile and the "--kiosk-printing" switch: Edge then prints straight to the Windows DEFAULT
 * printer without a print window, and the page closes itself. Only receipts use this – A4 invoices
 * and barcode stickers keep the normal print window, so a separate label printer can still be chosen.
 */
export function findEdge(): string | null {
  if (process.platform !== "win32") return null;
  const roots = [process.env["ProgramFiles(x86)"], process.env.ProgramFiles, process.env.LOCALAPPDATA].filter(Boolean) as string[];
  for (const r of roots) {
    const p = path.join(r, "Microsoft", "Edge", "Application", "msedge.exe");
    if (existsSync(p)) return p;
  }
  return null;
}

function profileDir() {
  // Next to the shop data on installed PCs; in a temp folder during development.
  const base = process.env.KPR_DATA_DIR ?? path.join(os.tmpdir(), "kpr-pitstop");
  const dir = path.join(base, "edge-print");
  mkdirSync(dir, { recursive: true });
  return dir;
}

/** Opens `url` in the silent-print window. Returns false when Edge is not available. */
export function openSilentPrint(url: string): boolean {
  // Testing / support: log the print link instead of printing (KPR_SILENT_PRINT_DRYRUN=1)
  if (process.env.KPR_SILENT_PRINT_DRYRUN === "1") {
    console.log("[kpr] silent print (dry run):", url);
    return true;
  }
  const edge = findEdge();
  if (!edge) return false;
  const child = spawn(
    edge,
    [
      `--user-data-dir=${profileDir()}`,
      "--kiosk-printing",
      "--no-first-run",
      "--no-default-browser-check",
      "--disable-sync",
      "--window-position=-3000,-3000",
      "--window-size=420,640",
      `--app=${url}`,
    ],
    { detached: true, stdio: "ignore", windowsHide: false },
  );
  child.on("error", () => null);
  child.unref();
  return true;
}
