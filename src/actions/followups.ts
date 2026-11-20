"use server";

import { revalidatePath } from "next/cache";
import { db } from "@/lib/db";
import { requireAction } from "@/lib/auth";
import { addDays, ymd } from "@/lib/format";
import { FOLLOWUP_TYPES, TRIGGERS, dayAt, runScheduledRules } from "@/lib/workflows";
import { audit, errMsg, num, optInt, optStr, str, type ActionResult } from "@/lib/server-utils";

const INTERACTION_TYPES = ["CALL", "VISIT", "WHATSAPP", "COMPLAINT", "NOTE"];

function refresh(customerId?: number | null) {
  revalidatePath("/followups");
  revalidatePath("/", "layout");
  if (customerId) revalidatePath(`/customers/${customerId}`);
}

// ── Follow-ups ──

export async function createFollowUp(_: ActionResult, fd: FormData): Promise<ActionResult> {
  try {
    const s = await requireAction("followups");
    let customerId = optInt(fd, "customerId");
    const phone = str(fd, "phone").replace(/[\s-]/g, "");
    if (!customerId && phone) {
      const c = await db.customer.findUnique({ where: { phone }, select: { id: true } });
      if (!c) return { error: "No customer with that mobile number. Leave it empty for a general task." };
      customerId = c.id;
    }
    const title = str(fd, "title");
    if (!title) return { error: "Write what needs to be done." };
    const type = str(fd, "type");
    const due = str(fd, "dueDate") || ymd();
    const f = await db.followUp.create({
      data: {
        customerId,
        type: type in FOLLOWUP_TYPES ? type : "CALL",
        title,
        notes: optStr(fd, "notes"),
        dueDate: dayAt(due),
        assignedToId: optInt(fd, "assignedToId"),
        createdById: s.uid,
      },
    });
    await audit(s.uid, "FOLLOWUP_CREATED", "FollowUp", f.id, title);
    refresh(customerId);
    return { ok: "Follow-up added." };
  } catch (e) {
    return { error: errMsg(e) };
  }
}

/** Mark done (with what the customer said), optionally booking the next follow-up. */
export async function completeFollowUp(_: ActionResult, fd: FormData): Promise<ActionResult> {
  try {
    const s = await requireAction("followups");
    const id = optInt(fd, "id");
    if (!id) return { error: "Missing follow-up." };
    const skip = fd.get("_skip") === "1";
    const outcome = optStr(fd, "outcome");
    const f = await db.followUp.update({
      where: { id },
      data: { status: skip ? "SKIPPED" : "DONE", outcome, doneAt: new Date(), doneById: s.uid },
    });
    // Keep the customer's contact history complete
    if (f.customerId && !skip) {
      await db.customerInteraction.create({
        data: { customerId: f.customerId, type: f.type === "OTHER" ? "NOTE" : "CALL", note: `${f.title}${outcome ? ` → ${outcome}` : ""}`, userId: s.uid, userName: s.name },
      });
    }
    const nextIn = num(fd, "nextInDays");
    if (!skip && nextIn > 0) {
      await db.followUp.create({
        data: {
          customerId: f.customerId,
          vehicleId: f.vehicleId,
          type: f.type,
          title: f.title,
          notes: outcome ? `Previous: ${outcome}` : null,
          dueDate: dayAt(addDays(ymd(), Math.round(nextIn))),
          assignedToId: f.assignedToId,
          createdById: s.uid,
          refType: f.refType,
          refId: f.refId,
        },
      });
    }
    await audit(s.uid, skip ? "FOLLOWUP_SKIPPED" : "FOLLOWUP_DONE", "FollowUp", id, outcome ?? undefined);
    refresh(f.customerId);
    return { ok: skip ? "Skipped." : nextIn > 0 ? `Done – next follow-up booked in ${nextIn} days.` : "Marked done." };
  } catch (e) {
    return { error: errMsg(e) };
  }
}

export async function snoozeFollowUp(fd: FormData) {
  const s = await requireAction("followups");
  const id = Number(fd.get("id"));
  const days = Math.max(1, Math.min(60, Number(fd.get("days")) || 1));
  const f = await db.followUp.update({ where: { id }, data: { dueDate: dayAt(addDays(ymd(), days)) } });
  await audit(s.uid, "FOLLOWUP_SNOOZED", "FollowUp", id, `${days} days`);
  refresh(f.customerId);
}

export async function reopenFollowUp(fd: FormData) {
  const s = await requireAction("followups");
  const id = Number(fd.get("id"));
  const f = await db.followUp.update({ where: { id }, data: { status: "OPEN", doneAt: null, doneById: null } });
  await audit(s.uid, "FOLLOWUP_REOPENED", "FollowUp", id);
  refresh(f.customerId);
}

// ── Customer interaction log ──

export async function addInteraction(_: ActionResult, fd: FormData): Promise<ActionResult> {
  try {
    const s = await requireAction("customers");
    const customerId = optInt(fd, "customerId");
    const note = str(fd, "note");
    if (!customerId || !note) return { error: "Write a note." };
    const type = str(fd, "type");
    await db.customerInteraction.create({
      data: { customerId, type: INTERACTION_TYPES.includes(type) ? type : "NOTE", note, userId: s.uid, userName: s.name },
    });
    refresh(customerId);
    return { ok: "Saved to the customer's history." };
  } catch (e) {
    return { error: errMsg(e) };
  }
}

export async function deleteInteraction(fd: FormData) {
  const s = await requireAction("customers");
  const id = Number(fd.get("id"));
  const i = await db.customerInteraction.findUnique({ where: { id } });
  if (!i) return;
  if (s.role !== "OWNER" && i.userId !== s.uid) throw new Error("You can only delete your own notes.");
  await db.customerInteraction.delete({ where: { id } });
  refresh(i.customerId);
}

// ── Workflow rules ──

export async function saveWorkflowRule(_: ActionResult, fd: FormData): Promise<ActionResult> {
  try {
    const s = await requireAction("settings");
    const id = optInt(fd, "id");
    const name = str(fd, "name");
    const trigger = str(fd, "trigger");
    const title = str(fd, "title");
    if (!name || !title) return { error: "Give the rule a name and a task title." };
    if (!(trigger in TRIGGERS)) return { error: "Choose when the rule runs." };
    const type = str(fd, "followUpType");
    const data = {
      name,
      trigger,
      title,
      delayDays: Math.max(0, Math.min(730, Math.round(num(fd, "delayDays")))),
      followUpType: type in FOLLOWUP_TYPES ? type : "CALL",
      minAmount: Math.max(0, num(fd, "minAmount")),
      assignUserId: optInt(fd, "assignUserId"),
      active: fd.get("active") === "on",
    };
    if (id) await db.workflowRule.update({ where: { id }, data });
    else await db.workflowRule.create({ data });
    await audit(s.uid, id ? "WORKFLOW_UPDATED" : "WORKFLOW_CREATED", "WorkflowRule", id, name);
    revalidatePath("/settings/workflows");
    return { ok: "Rule saved." };
  } catch (e) {
    return { error: errMsg(e) };
  }
}

export async function toggleWorkflowRule(fd: FormData) {
  const s = await requireAction("settings");
  const id = Number(fd.get("id"));
  const r = await db.workflowRule.findUniqueOrThrow({ where: { id } });
  await db.workflowRule.update({ where: { id }, data: { active: !r.active } });
  await audit(s.uid, r.active ? "WORKFLOW_OFF" : "WORKFLOW_ON", "WorkflowRule", id, r.name);
  revalidatePath("/settings/workflows");
}

export async function deleteWorkflowRule(fd: FormData) {
  const s = await requireAction("settings");
  const id = Number(fd.get("id"));
  const r = await db.workflowRule.delete({ where: { id } });
  await audit(s.uid, "WORKFLOW_DELETED", "WorkflowRule", id, r.name);
  revalidatePath("/settings/workflows");
}

export async function runWorkflowsNow(_: ActionResult): Promise<ActionResult> {
  try {
    await requireAction("settings");
    const n = await runScheduledRules(true);
    refresh();
    return { ok: n ? `${n} new follow-ups created.` : "Checked – nothing new to create right now." };
  } catch (e) {
    return { error: errMsg(e) };
  }
}
