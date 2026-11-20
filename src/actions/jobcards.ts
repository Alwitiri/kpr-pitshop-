"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { db } from "@/lib/db";
import { requireAction } from "@/lib/auth";
import { JOB_STATUSES } from "@/lib/calc";
import { fireEvent } from "@/lib/workflows";
import { audit, errMsg, nextNumber, num, optInt, optStr, str, type ActionResult } from "@/lib/server-utils";

export async function createJobCard(_: ActionResult, fd: FormData): Promise<ActionResult> {
  let id = 0;
  try {
    const s = await requireAction("jobcards");
    let customerId = optInt(fd, "customerId");
    let vehicleId = optInt(fd, "vehicleId");
    const complaint = str(fd, "complaint");
    if (!complaint) return { error: "Describe the work / complaint." };

    id = await db.$transaction(async (tx) => {
      if (!customerId) {
        const name = str(fd, "c_name");
        const phone = str(fd, "c_phone").replace(/[\s-]/g, "");
        if (!name || !phone) throw new Error("Select a customer or enter new customer name and mobile.");
        const ex = await tx.customer.findUnique({ where: { phone } });
        customerId = ex?.id ?? (await tx.customer.create({ data: { name, phone } })).id;
      }
      const make = str(fd, "v_make");
      if (!vehicleId && make) {
        vehicleId = (await tx.vehicle.create({ data: { customerId, type: str(fd, "v_type") || "BIKE", make, model: optStr(fd, "v_model"), regNo: optStr(fd, "v_regNo")?.toUpperCase() ?? null } })).id;
      }
      const number = await nextNumber(tx, "jobcard", "JOB");
      const promised = str(fd, "promisedAt");
      const j = await tx.jobCard.create({
        data: {
          number, customerId, vehicleId, complaint,
          technicianId: optInt(fd, "technicianId"),
          odometer: optInt(fd, "odometer"),
          labourCharge: num(fd, "labourCharge"),
          estimate: num(fd, "estimate"),
          promisedAt: promised ? new Date(`${promised}:00+05:30`) : null,
        },
      });
      return j.id;
    });
    await audit(s.uid, "JOBCARD_CREATED", "JobCard", id);
  } catch (e) {
    return { error: errMsg(e) };
  }
  revalidatePath("/jobcards");
  redirect(`/jobcards/${id}`);
}

export async function updateJobCard(_: ActionResult, fd: FormData): Promise<ActionResult> {
  try {
    const s = await requireAction("jobcards");
    const id = optInt(fd, "id")!;
    const promised = str(fd, "promisedAt");
    await db.jobCard.update({
      where: { id },
      data: {
        complaint: str(fd, "complaint"),
        diagnosis: optStr(fd, "diagnosis"),
        technicianId: optInt(fd, "technicianId"),
        odometer: optInt(fd, "odometer"),
        labourCharge: num(fd, "labourCharge"),
        estimate: num(fd, "estimate"),
        promisedAt: promised ? new Date(`${promised}:00+05:30`) : null,
      },
    });
    await audit(s.uid, "JOBCARD_UPDATED", "JobCard", id);
    revalidatePath(`/jobcards/${id}`);
    return { ok: "Job card updated." };
  } catch (e) {
    return { error: errMsg(e) };
  }
}

export async function setJobStatus(fd: FormData) {
  const s = await requireAction("jobcards");
  const id = Number(fd.get("id"));
  const status = String(fd.get("status"));
  if (!(JOB_STATUSES as readonly string[]).includes(status)) return;
  const now = new Date();
  const before = await db.jobCard.findUnique({ where: { id }, select: { status: true } });
  const job = await db.jobCard.update({
    where: { id },
    data: {
      status,
      ...(status === "COMPLETED" ? { completedAt: now } : {}),
      ...(status === "DELIVERED" ? { deliveredAt: now } : {}),
    },
  });
  await audit(s.uid, "JOBCARD_STATUS", "JobCard", id, status);
  if (before?.status !== status && (status === "COMPLETED" || status === "DELIVERED")) {
    await fireEvent(status === "COMPLETED" ? "JOB_COMPLETED" : "JOB_DELIVERED", { customerId: job.customerId, vehicleId: job.vehicleId, refType: "JobCard", refId: id, job: job.number });
  }
  revalidatePath("/jobcards");
  revalidatePath(`/jobcards/${id}`);
}

export async function addJobPart(_: ActionResult, fd: FormData): Promise<ActionResult> {
  try {
    await requireAction("jobcards");
    const jobCardId = optInt(fd, "jobCardId")!;
    const productId = optInt(fd, "productId");
    const q = num(fd, "qty", 1);
    if (!productId || q <= 0) return { error: "Choose a product and quantity." };
    const p = await db.product.findUniqueOrThrow({ where: { id: productId } });
    const price = str(fd, "unitPrice") ? num(fd, "unitPrice") : p.sellingPrice;
    await db.jobCardPart.create({ data: { jobCardId, productId, qty: q, unitPrice: price } });
    revalidatePath(`/jobcards/${jobCardId}`);
    return { ok: `${p.name} added.${p.stock < q ? ` Warning: only ${p.stock} in stock.` : ""}` };
  } catch (e) {
    return { error: errMsg(e) };
  }
}

export async function removeJobPart(fd: FormData) {
  await requireAction("jobcards");
  const part = await db.jobCardPart.delete({ where: { id: Number(fd.get("id")) } });
  revalidatePath(`/jobcards/${part.jobCardId}`);
}
