"use server";

import { headers } from "next/headers";
import { db } from "@/lib/db";
import { createHandoffToken, requireAction } from "@/lib/auth";
import { can } from "@/lib/roles";
import { getSettings } from "@/lib/server-utils";
import { openSilentPrint } from "@/lib/silent-print";

export type PrintResult = { mode: "silent" | "dialog"; note?: string; error?: string };

/** True when the request comes from the shop PC itself (the one running Spoaxio Software). */
async function shopPc() {
  const h = await headers();
  const host = h.get("host") ?? "";
  const name = host.replace(/:\d+$/, "").replace(/^\[|\]$/g, "");
  return { local: ["localhost", "127.0.0.1", "::1"].includes(name), host };
}

/**
 * Print a bill's receipt. With silent printing on and the click made on the shop PC, the receipt goes
 * straight to the Windows default printer. Otherwise the caller shows the normal print window.
 */
export async function printReceipt(saleId: number): Promise<PrintResult> {
  try {
    const s = await requireAction();
    if (!can(s.role, "pos") && !can(s.role, "sales")) return { mode: "dialog", error: "You do not have permission to print bills." };
    const settings = await getSettings();
    if (!settings.silentPrint) return { mode: "dialog" };
    const { local, host } = await shopPc();
    if (!local) return { mode: "dialog", note: "Silent printing works on the shop PC only – this device shows the print window." };
    const token = await createHandoffToken(s);
    const next = `/print/invoice/${saleId}?size=receipt&silent=1`;
    const ok = openSilentPrint(`http://${host}/api/handoff?t=${encodeURIComponent(token)}&next=${encodeURIComponent(next)}`);
    if (!ok) return { mode: "dialog", note: "Microsoft Edge was not found, so the print window is shown instead." };
    return { mode: "silent" };
  } catch (e) {
    return { mode: "dialog", error: e instanceof Error ? e.message : "Could not print." };
  }
}

/** Settings → Printing → "Test print": prints the latest bill's receipt with the current settings. */
export async function testReceiptPrint(): Promise<PrintResult & { saleId?: number }> {
  await requireAction("settings");
  const last = await db.sale.findFirst({ orderBy: { id: "desc" }, select: { id: true } });
  if (!last) return { mode: "dialog", error: "Make one bill first – the test prints the latest receipt." };
  return { ...(await printReceipt(last.id)), saleId: last.id };
}

/** Settings → Printing */
export async function savePrintSettings(_: { ok?: string; error?: string } | null, fd: FormData): Promise<{ ok?: string; error?: string }> {
  try {
    const s = await requireAction("settings");
    const width = fd.get("receiptWidth") === "58mm" ? "58mm" : "80mm";
    await db.shopSettings.update({
      where: { id: 1 },
      data: { receiptWidth: width, silentPrint: fd.get("silentPrint") === "on", receiptAutoPrint: fd.get("receiptAutoPrint") === "on" },
    });
    await db.auditLog.create({ data: { userId: s.uid, action: "PRINT_SETTINGS_SAVED", entity: "ShopSettings", entityId: "1", details: `${width}${fd.get("silentPrint") === "on" ? ", silent" : ""}${fd.get("receiptAutoPrint") === "on" ? ", auto after sale" : ""}` } });
    const { revalidatePath } = await import("next/cache");
    revalidatePath("/", "layout");
    return { ok: "Printing settings saved." };
  } catch (e) {
    return { error: e instanceof Error ? e.message : "Could not save." };
  }
}
