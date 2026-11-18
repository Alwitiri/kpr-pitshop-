"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { db } from "@/lib/db";
import { requireAction } from "@/lib/auth";
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
