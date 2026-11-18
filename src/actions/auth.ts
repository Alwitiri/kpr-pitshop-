"use server";

import bcrypt from "bcryptjs";
import { redirect } from "next/navigation";
import { db } from "@/lib/db";
import { createSession, destroySession, getSession, requireAction } from "@/lib/auth";
import { audit, str, type ActionResult } from "@/lib/server-utils";

export async function login(_: ActionResult, fd: FormData): Promise<ActionResult> {
  const username = str(fd, "username").toLowerCase();
  const password = str(fd, "password");
  if (!username || !password) return { error: "Enter username and password." };
  const user = await db.user.findUnique({ where: { username } });
  if (!user || !user.active || !(await bcrypt.compare(password, user.passwordHash))) {
    await audit(user?.id ?? null, "LOGIN_FAILED", "User", user?.id, username);
    return { error: "Wrong username or password." };
  }
  await createSession({ uid: user.id, name: user.name, role: user.role, username: user.username });
  await audit(user.id, "LOGIN", "User", user.id);
  redirect(user.role === "CASHIER" ? "/pos" : user.role === "TECHNICIAN" ? "/jobcards" : "/");
}

export async function logout() {
  const s = await getSession();
  if (s) await audit(s.uid, "LOGOUT", "User", s.uid);
  await destroySession();
  redirect("/login");
}

export async function changeOwnPassword(_: ActionResult, fd: FormData): Promise<ActionResult> {
  const s = await requireAction();
  const current = str(fd, "current");
  const next = str(fd, "next");
  if (next.length < 6) return { error: "New password must be at least 6 characters." };
  const user = await db.user.findUniqueOrThrow({ where: { id: s.uid } });
  if (!(await bcrypt.compare(current, user.passwordHash))) return { error: "Current password is wrong." };
  await db.user.update({ where: { id: s.uid }, data: { passwordHash: await bcrypt.hash(next, 10) } });
  await audit(s.uid, "PASSWORD_CHANGED", "User", s.uid);
  return { ok: "Password changed." };
}
