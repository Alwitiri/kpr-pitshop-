"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { db } from "@/lib/db";
import type { Prisma } from "@prisma/client";
import { requireAction } from "@/lib/auth";
import { can } from "@/lib/roles";
import { columns, parseCsv } from "@/lib/csv";
import { audit, bool, errMsg, num, optInt, optStr, str, type ActionResult } from "@/lib/server-utils";

const cleanPhone = (p: string | null) => (p ? p.replace(/[\s-]/g, "") : null);

export async function saveCustomer(_: ActionResult, fd: FormData): Promise<ActionResult> {
  let id = optInt(fd, "id");
  try {
    const s = await requireAction("customers");
    const name = str(fd, "name");
    if (!name) return { error: "Name is required." };
    const phone = cleanPhone(optStr(fd, "phone"));
    if (phone && !/^\+?\d{10,13}$/.test(phone)) return { error: "Enter a valid mobile number." };
    const optIn = bool(fd, "whatsappOptIn");
    const existing = id ? await db.customer.findUnique({ where: { id } }) : null;
    const data = {
      name,
      phone,
      altPhone: optStr(fd, "altPhone"),
      email: optStr(fd, "email"),
      address: optStr(fd, "address"),
      gstin: optStr(fd, "gstin")?.toUpperCase() ?? null,
      birthday: optStr(fd, "birthday"),
      tags: optStr(fd, "tags"),
      notes: optStr(fd, "notes"),
      openingBalance: num(fd, "openingBalance"),
      whatsappOptIn: optIn,
      // Keep a record of when / how consent was given (needed for WhatsApp marketing later)
      optInAt: optIn ? (existing?.whatsappOptIn ? existing.optInAt : new Date()) : null,
      optInSource: optIn ? (existing?.whatsappOptIn ? existing.optInSource : str(fd, "optInSource") || "Shop counter") : null,
    };
    if (id) {
      await db.customer.update({ where: { id }, data });
    } else {
      const make = str(fd, "v_make");
      const c = await db.customer.create({
        data: {
          ...data,
          vehicles: make ? { create: [{ type: str(fd, "v_type") || "BIKE", make, model: optStr(fd, "v_model"), regNo: optStr(fd, "v_regNo")?.toUpperCase() ?? null, year: optInt(fd, "v_year") }] } : undefined,
        },
      });
      id = c.id;
    }
    await audit(s.uid, "CUSTOMER_SAVED", "Customer", id, name);
  } catch (e) {
    return { error: errMsg(e) };
  }
  revalidatePath("/customers");
  if (fd.get("_new")) redirect(`/customers/${id}`);
  return { ok: "Customer saved." };
}

export async function addVehicle(_: ActionResult, fd: FormData): Promise<ActionResult> {
  try {
    await requireAction("customers");
    const customerId = optInt(fd, "customerId");
    const make = str(fd, "make");
    if (!customerId || !make) return { error: "Vehicle make is required." };
    await db.vehicle.create({
      data: { customerId, type: str(fd, "type") || "BIKE", make, model: optStr(fd, "model"), regNo: optStr(fd, "regNo")?.toUpperCase() ?? null, year: optInt(fd, "year"), color: optStr(fd, "color") },
    });
    revalidatePath(`/customers/${customerId}`);
    return { ok: "Vehicle added." };
  } catch (e) {
    return { error: errMsg(e) };
  }
}

export async function deleteVehicle(fd: FormData) {
  await requireAction("customers");
  const id = Number(fd.get("id"));
  const v = await db.vehicle.delete({ where: { id } });
  revalidatePath(`/customers/${v.customerId}`);
}

// ── Data migration: import customers (and their vehicles) from Excel / CSV ──
const MONTHS = ["jan", "feb", "mar", "apr", "may", "jun", "jul", "aug", "sep", "oct", "nov", "dec"];

/** Accepts MM-DD, DD/MM, DD/MM/YYYY, YYYY-MM-DD or "25 Aug" and returns MM-DD (or null). */
function toBirthday(raw: string): string | null {
  const v = raw.trim().toLowerCase();
  if (!v) return null;
  let m: RegExpMatchArray | null;
  const ok = (mm: number, dd: number) => (mm >= 1 && mm <= 12 && dd >= 1 && dd <= 31 ? `${String(mm).padStart(2, "0")}-${String(dd).padStart(2, "0")}` : null);
  if ((m = v.match(/^(\d{4})-(\d{1,2})-(\d{1,2})$/))) return ok(+m[2], +m[3]);
  if ((m = v.match(/^(\d{1,2})[/.-](\d{1,2})[/.-]\d{2,4}$/))) return ok(+m[2], +m[1]); // Indian DD/MM/YYYY
  if ((m = v.match(/^(\d{1,2})\/(\d{1,2})$/))) return ok(+m[2], +m[1]); // DD/MM
  if ((m = v.match(/^(\d{1,2})-(\d{1,2})$/))) return ok(+m[1], +m[2]); // MM-DD (app format)
  if ((m = v.match(/^(\d{1,2})\s*([a-z]{3})/))) return ok(MONTHS.indexOf(m[2]) + 1, +m[1]);
  return null;
}

export async function importCustomers(_: ActionResult, fd: FormData): Promise<ActionResult> {
  try {
    const s = await requireAction("customers");
    if (!can(s.role, "importData")) return { error: "You do not have permission to import data." };
    const file = fd.get("file") as File | null;
    if (!file || file.size === 0) return { error: "Choose a CSV file (save your Excel sheet as CSV)." };
    const rows = parseCsv((await file.text()).replace(/^﻿/, ""));
    if (rows.length < 2) return { error: "The file has no data rows." };
    const { has, col } = columns(rows[0]);
    if (!has("name")) return { error: 'Missing "name" column. Download the template to see the format.' };

    let created = 0, updated = 0, vehiclesAdded = 0;
    const errors: string[] = [];
    for (let r = 1; r < rows.length; r++) {
      const row = rows[r];
      const name = col(row, "name");
      if (!name) continue;
      try {
        const phone = cleanPhone(col(row, "phone") || null);
        if (phone && !/^\+?\d{10,13}$/.test(phone)) throw new Error(`bad mobile number "${col(row, "phone")}"`);
        const yes = /^(y|yes|1|true)$/i.test(col(row, "whatsapp_opt_in"));
        const balRaw = col(row, "opening_balance").replace(/[₹,\s]/g, "");
        // Only fill what the sheet has – never wipe saved details with blank cells.
        const data: Prisma.CustomerUpdateInput = { name };
        const text = (k: string) => col(row, k) || undefined;
        data.altPhone = cleanPhone(text("alt_phone") ?? null) ?? undefined;
        data.email = text("email");
        data.address = text("address");
        data.gstin = text("gstin")?.toUpperCase();
        data.birthday = toBirthday(col(row, "birthday")) ?? undefined;
        data.tags = text("tags");
        data.notes = text("notes");
        if (balRaw && Number.isFinite(Number(balRaw))) data.openingBalance = Number(balRaw);

        const existing = phone ? await db.customer.findUnique({ where: { phone }, include: { vehicles: true } }) : null;
        if (yes && !existing?.whatsappOptIn) Object.assign(data, { whatsappOptIn: true, optInAt: new Date(), optInSource: "Imported from old records" });
        let customerId: number;
        if (existing) {
          await db.customer.update({ where: { id: existing.id }, data });
          customerId = existing.id;
          updated++;
        } else {
          customerId = (await db.customer.create({ data: { ...(data as Prisma.CustomerCreateInput), name, phone } })).id;
          created++;
        }
        const make = col(row, "vehicle_make");
        if (make) {
          const regNo = col(row, "vehicle_reg_no").toUpperCase() || null;
          const model = col(row, "vehicle_model") || null;
          const known = existing?.vehicles ?? (await db.vehicle.findMany({ where: { customerId } }));
          const dup = known.some((v) => (regNo ? v.regNo === regNo : v.make.toLowerCase() === make.toLowerCase() && (v.model ?? "") === (model ?? "")));
          if (!dup) {
            const year = parseInt(col(row, "vehicle_year"), 10);
            await db.vehicle.create({
              data: { customerId, type: /car/i.test(col(row, "vehicle_type")) ? "CAR" : "BIKE", make, model, regNo, year: Number.isFinite(year) ? year : null },
            });
            vehiclesAdded++;
          }
        }
      } catch (e) {
        errors.push(`Row ${r + 1} (${name}): ${errMsg(e)}`);
      }
    }
    await audit(s.uid, "CUSTOMERS_IMPORTED", "Customer", null, `${created} created, ${updated} updated, ${vehiclesAdded} vehicles`);
    revalidatePath("/customers");
    const msg = `${created} customers created, ${updated} updated, ${vehiclesAdded} vehicles added.`;
    if (errors.length) return { error: `${msg} ${errors.length} rows failed: ${errors.slice(0, 5).join(" | ")}` };
    return { ok: msg };
  } catch (e) {
    return { error: errMsg(e) };
  }
}
