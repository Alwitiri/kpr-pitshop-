"use server";

import { revalidatePath } from "next/cache";
import { requireAction } from "@/lib/auth";
import { removeLogo, saveLogo } from "@/lib/branding";
import { audit, errMsg, type ActionResult } from "@/lib/server-utils";

export async function uploadLogo(_: ActionResult, fd: FormData): Promise<ActionResult> {
  try {
    const s = await requireAction("settings");
    const name = await saveLogo(fd.get("logo") as File);
    await audit(s.uid, "LOGO_UPDATED", "ShopSettings", 1, name);
    revalidatePath("/", "layout");
    return { ok: "Logo saved. It now shows on the login screen, menu and bills." };
  } catch (e) {
    return { error: errMsg(e) };
  }
}

export async function deleteLogo(_: ActionResult): Promise<ActionResult> {
  try {
    const s = await requireAction("settings");
    await removeLogo();
    await audit(s.uid, "LOGO_REMOVED", "ShopSettings", 1);
    revalidatePath("/", "layout");
    return { ok: "Logo removed." };
  } catch (e) {
    return { error: errMsg(e) };
  }
}
