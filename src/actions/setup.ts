"use server";

import bcrypt from "bcryptjs";
import { redirect } from "next/navigation";
import { db } from "@/lib/db";
import { createSession } from "@/lib/auth";
import { audit, str, type ActionResult } from "@/lib/server-utils";

const DEFAULT_CATEGORIES: [string, string][] = [
  ["Helmets", "BIKE"], ["Riding Gear", "BIKE"], ["Bike Lights & Electricals", "BIKE"], ["Bike Body Parts", "BIKE"],
  ["Bike Care & Lubricants", "BIKE"], ["Bike Locks & Security", "BIKE"], ["Car Seat Covers", "CAR"], ["Car Mats", "CAR"],
  ["Car Electronics", "CAR"], ["Car Care", "CAR"], ["Car Exterior", "CAR"], ["Tyres & Tubes", "BOTH"], ["Batteries", "BOTH"],
  ["Mobile Holders & Chargers", "BOTH"], ["Service / Labour", "BOTH"],
];

/** First run only: creates the shop details and the owner login. */
export async function firstRunSetup(_: ActionResult, fd: FormData): Promise<ActionResult> {
  if ((await db.user.count()) > 0) redirect("/login");
  const shopName = str(fd, "shopName");
  const name = str(fd, "name");
  const username = str(fd, "username").toLowerCase();
  const password = str(fd, "password");
  if (!shopName || !name) return { error: "Enter the shop name and owner name." };
  if (!/^[a-z0-9._-]{3,30}$/.test(username)) return { error: "Username: 3–30 letters/numbers, no spaces." };
  if (password.length < 6) return { error: "Password must be at least 6 characters." };
  if (password !== str(fd, "confirm")) return { error: "Passwords do not match." };

  const user = await db.$transaction(async (tx) => {
    await tx.shopSettings.upsert({
      where: { id: 1 },
      create: { id: 1, shopName, phone: str(fd, "phone") || null, address: str(fd, "address") || null, gstin: str(fd, "gstin").toUpperCase() || null },
      update: { shopName, phone: str(fd, "phone") || null, address: str(fd, "address") || null, gstin: str(fd, "gstin").toUpperCase() || null },
    });
    if ((await tx.category.count()) === 0 && fd.get("categories")) {
      await tx.category.createMany({ data: DEFAULT_CATEGORIES.map(([n, type]) => ({ name: n, type })) });
    }
    return tx.user.create({ data: { name, username, role: "OWNER", passwordHash: await bcrypt.hash(password, 10) } });
  });
  await audit(user.id, "FIRST_RUN_SETUP", "System", null, shopName);
  await createSession({ uid: user.id, name: user.name, role: user.role, username: user.username });
  redirect("/");
}
