"use server";

import bcrypt from "bcryptjs";
import { revalidatePath } from "next/cache";
import { db } from "@/lib/db";
import { requireAction } from "@/lib/auth";
import { ROLES } from "@/lib/roles";
import { audit, bool, errMsg, num, optInt, optStr, str, type ActionResult } from "@/lib/server-utils";

export async function saveUser(_: ActionResult, fd: FormData): Promise<ActionResult> {
  try {
    const s = await requireAction("staff");
    const id = optInt(fd, "id");
    const name = str(fd, "name");
    const username = str(fd, "username").toLowerCase();
    const role = str(fd, "role");
    const password = str(fd, "password");
    if (!name || !username) return { error: "Name and username are required." };
    if (!/^[a-z0-9._-]{3,30}$/.test(username)) return { error: "Username: 3–30 letters/numbers, no spaces." };
    if (!(ROLES as readonly string[]).includes(role)) return { error: "Choose a role." };
    const active = id ? bool(fd, "active") : true;

    if (id) {
      const current = await db.user.findUniqueOrThrow({ where: { id } });
      if (current.role === "OWNER" && (role !== "OWNER" || !active)) {
        const owners = await db.user.count({ where: { role: "OWNER", active: true } });
        if (owners <= 1) return { error: "There must be at least one active owner." };
      }
      if (password && password.length < 6) return { error: "Password must be at least 6 characters." };
      await db.user.update({
        where: { id },
        data: { name, username, role, phone: optStr(fd, "phone"), active, ...(password ? { passwordHash: await bcrypt.hash(password, 10) } : {}) },
      });
      await audit(s.uid, password ? "USER_UPDATED_PASSWORD_RESET" : "USER_UPDATED", "User", id, `${username} ${role}`);
    } else {
      if (password.length < 6) return { error: "Password must be at least 6 characters." };
      const u = await db.user.create({ data: { name, username, role, phone: optStr(fd, "phone"), passwordHash: await bcrypt.hash(password, 10) } });
      await audit(s.uid, "USER_CREATED", "User", u.id, `${username} ${role}`);
    }
    revalidatePath("/staff");
    return { ok: "Staff member saved." };
  } catch (e) {
    return { error: errMsg(e) };
  }
}

export async function saveAttendance(_: ActionResult, fd: FormData): Promise<ActionResult> {
  try {
    const s = await requireAction("staff");
    const date = str(fd, "date");
    if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) return { error: "Invalid date." };
    let n = 0;
    for (const [k, v] of fd.entries()) {
      if (!k.startsWith("st_") || typeof v !== "string" || !v) continue;
      const userId = Number(k.slice(3));
      const note = str(fd, `note_${userId}`) || null;
      await db.attendance.upsert({ where: { userId_date: { userId, date } }, create: { userId, date, status: v, note }, update: { status: v, note } });
      n++;
    }
    await audit(s.uid, "ATTENDANCE_SAVED", "Attendance", date, `${n} staff`);
    revalidatePath("/staff/attendance");
    return { ok: `Attendance saved for ${n} staff.` };
  } catch (e) {
    return { error: errMsg(e) };
  }
}

export async function saveSettings(_: ActionResult, fd: FormData): Promise<ActionResult> {
  try {
    const s = await requireAction("settings");
    await db.shopSettings.upsert({
      where: { id: 1 },
      create: { id: 1 },
      update: {
        shopName: str(fd, "shopName") || "KPR Pitstop N Sportz",
        tagline: optStr(fd, "tagline"),
        address: optStr(fd, "address"),
        phone: optStr(fd, "phone"),
        email: optStr(fd, "email"),
        gstin: optStr(fd, "gstin")?.toUpperCase() ?? null,
        stateName: str(fd, "stateName") || "Tamil Nadu",
        stateCode: str(fd, "stateCode") || "33",
        invoicePrefix: (str(fd, "invoicePrefix") || "KPR").toUpperCase().replace(/[^A-Z0-9/]/g, ""),
        invoiceFooter: optStr(fd, "invoiceFooter"),
        defaultMinStock: Math.max(0, Math.round(num(fd, "defaultMinStock", 5))),
        deadStockDays: Math.max(15, Math.round(num(fd, "deadStockDays", 90))),
        bankDetails: optStr(fd, "bankDetails"),
        upiId: optStr(fd, "upiId"),
      },
    });
    await audit(s.uid, "SETTINGS_UPDATED", "ShopSettings", 1);
    revalidatePath("/", "layout");
    return { ok: "Settings saved." };
  } catch (e) {
    return { error: errMsg(e) };
  }
}
