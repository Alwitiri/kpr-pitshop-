"use server";

import { revalidatePath } from "next/cache";
import { db } from "@/lib/db";
import { requireAction } from "@/lib/auth";
import { loadPermissions } from "@/lib/permissions";
import { ALL_PERMS, DEFAULT_PERMS, ROLE_LABEL, type Perm } from "@/lib/roles";
import { audit, errMsg, type ActionResult } from "@/lib/server-utils";

const EDITABLE = Object.keys(DEFAULT_PERMS);

export async function savePermissions(_: ActionResult, fd: FormData): Promise<ActionResult> {
  try {
    const s = await requireAction("staff");
    if (s.role !== "OWNER") return { error: "Only the owner can change permissions." };
    const reset = fd.get("_reset") === "1";
    const changes: string[] = [];
    for (const role of EDITABLE) {
      if (reset) {
        await db.rolePermission.deleteMany({ where: { role } });
        continue;
      }
      const perms = ALL_PERMS.filter((p) => fd.get(`${role}:${p}`) === "on");
      // Anyone with a login needs at least the dashboard to land on.
      if (!perms.includes("dashboard")) perms.unshift("dashboard" as Perm);
      await db.rolePermission.upsert({
        where: { role },
        create: { role, perms: JSON.stringify(perms) },
        update: { perms: JSON.stringify(perms) },
      });
      changes.push(`${ROLE_LABEL[role]}: ${perms.length}`);
    }
    await loadPermissions(true);
    await audit(s.uid, reset ? "PERMISSIONS_RESET" : "PERMISSIONS_SAVED", "RolePermission", null, reset ? "Factory defaults" : changes.join(", "));
    revalidatePath("/", "layout");
    return { ok: reset ? "Permissions reset to the factory defaults." : "Permissions saved. Staff see the change on their next click." };
  } catch (e) {
    return { error: errMsg(e) };
  }
}
