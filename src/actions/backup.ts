"use server";

import { revalidatePath } from "next/cache";
import { requireAction } from "@/lib/auth";
import { backupNow, backupPath, restoreFrom } from "@/lib/backup";
import { readFile } from "node:fs/promises";
import { audit, errMsg, str, type ActionResult } from "@/lib/server-utils";

async function ownerOnly() {
  const s = await requireAction("settings");
  if (s.role !== "OWNER") throw new Error("Only the owner can manage backups.");
  return s;
}

export async function makeBackup(_: ActionResult): Promise<ActionResult> {
  try {
    const s = await ownerOnly();
    const name = await backupNow("manual");
    await audit(s.uid, "BACKUP_CREATED", "System", null, name);
    revalidatePath("/settings");
    return { ok: `Backup saved: ${name}` };
  } catch (e) {
    return { error: errMsg(e) };
  }
}

/** Restore from an uploaded .db file or from a backup already in the backup folder. */
export async function restoreBackup(_: ActionResult, fd: FormData): Promise<ActionResult> {
  try {
    const s = await ownerOnly();
    if (str(fd, "confirm").toUpperCase() !== "RESTORE") return { error: 'Type RESTORE in the box to confirm.' };
    let data: Buffer;
    const file = fd.get("file") as File | null;
    const name = str(fd, "name");
    if (file && typeof file !== "string" && file.size > 0) {
      data = Buffer.from(await file.arrayBuffer());
    } else if (name) {
      const p = backupPath(name);
      if (!p) return { error: "Unknown backup." };
      data = await readFile(p);
    } else {
      return { error: "Choose a backup file." };
    }
    const safety = await restoreFrom(data);
    await audit(s.uid, "BACKUP_RESTORED", "System", null, `${name || "uploaded file"} (safety copy ${safety})`);
    revalidatePath("/", "layout");
    return { ok: `Restored. A safety copy of the previous data was saved as ${safety}. Please log in again if asked.` };
  } catch (e) {
    return { error: errMsg(e) };
  }
}
