import "server-only";
import { db } from "./db";
import { addDays, money, round2, ymd } from "./format";

/** What can start a workflow rule. Event triggers fire right away; scheduled ones are checked every hour. */
export const TRIGGERS: Record<string, { label: string; delay: string; scheduled?: boolean; amount?: boolean }> = {
  SALE_CREATED: { label: "A bill is made for a customer", delay: "days after the bill", amount: true },
  PAYMENT_DUE: { label: "A bill is left unpaid / part-paid", delay: "days after the bill", amount: true },
  JOB_COMPLETED: { label: "A job card is marked completed", delay: "days after completion" },
  JOB_DELIVERED: { label: "A vehicle is delivered", delay: "days after delivery" },
  BIRTHDAY: { label: "A customer's birthday is coming", delay: "days before the birthday", scheduled: true },
  WARRANTY_EXPIRING: { label: "A product's warranty is ending", delay: "days before it ends", scheduled: true },
  INACTIVE_CUSTOMER: { label: "A customer has not visited", delay: "days since the last bill", scheduled: true },
};

export const FOLLOWUP_TYPES: Record<string, string> = {
  CALL: "Call",
  FEEDBACK: "Feedback",
  SERVICE_DUE: "Service due",
  PAYMENT: "Payment",
  BIRTHDAY: "Birthday",
  WARRANTY: "Warranty",
  WIN_BACK: "Win back",
  OTHER: "Other",
};

export const PLACEHOLDERS = ["{customer}", "{vehicle}", "{invoice}", "{job}", "{amount}", "{item}"];

/** Local noon on a YYYY-MM-DD day – the stored time of a follow-up's due date. */
export const dayAt = (d: string) => new Date(`${d}T12:00:00+05:30`);

function fill(t: string, vars: Record<string, string | undefined>) {
  return t.replace(/\{(\w+)\}/g, (_, k) => vars[k] ?? "").replace(/\s+–\s*$|\(\s*\)/g, "").replace(/\s{2,}/g, " ").trim();
}

type Ctx = {
  customerId: number | null | undefined;
  vehicleId?: number | null;
  refType: string;
  refId: number;
  baseDay?: string; // YYYY-MM-DD, default today
  amount?: number;
  invoice?: string;
  job?: string;
};

/**
 * Run the active rules for an event (bill made, job delivered…).
 * Never throws – automation must not break billing.
 */
export async function fireEvent(trigger: string, ctx: Ctx) {
  try {
    if (!ctx.customerId) return;
    const rules = await db.workflowRule.findMany({ where: { trigger, active: true } });
    if (!rules.length) return;
    const [customer, vehicle] = await Promise.all([
      db.customer.findUnique({ where: { id: ctx.customerId }, select: { name: true } }),
      ctx.vehicleId ? db.vehicle.findUnique({ where: { id: ctx.vehicleId }, select: { make: true, model: true, regNo: true } }) : null,
    ]);
    if (!customer) return;
    const vars = {
      customer: customer.name,
      vehicle: vehicle ? [vehicle.make, vehicle.model, vehicle.regNo].filter(Boolean).join(" ") : "vehicle",
      invoice: ctx.invoice,
      job: ctx.job,
      amount: ctx.amount != null ? money(ctx.amount) : undefined,
    };
    for (const r of rules) {
      if (r.minAmount > 0 && (ctx.amount ?? 0) < r.minAmount) continue;
      await createFromRule(r, {
        customerId: ctx.customerId,
        vehicleId: ctx.vehicleId ?? null,
        refType: ctx.refType,
        refId: ctx.refId,
        due: addDays(ctx.baseDay ?? ymd(), r.delayDays),
        title: fill(r.title, vars),
        key: `r${r.id}:${ctx.refType}:${ctx.refId}`,
      });
    }
  } catch (e) {
    console.error("[kpr] workflow event failed", trigger, e);
  }
}

type Rule = { id: number; followUpType: string; assignUserId: number | null };

async function createFromRule(
  r: Rule,
  f: { customerId: number; vehicleId?: number | null; refType?: string; refId?: number; due: string; title: string; key: string },
) {
  try {
    await db.followUp.create({
      data: {
        customerId: f.customerId,
        vehicleId: f.vehicleId ?? null,
        type: r.followUpType,
        title: f.title.slice(0, 200),
        dueDate: dayAt(f.due),
        assignedToId: r.assignUserId,
        ruleId: r.id,
        refType: f.refType ?? null,
        refId: f.refId ?? null,
        dedupeKey: f.key,
      },
    });
    return true;
  } catch (e) {
    if (String(e).includes("Unique constraint")) return false; // already created earlier
    throw e;
  }
}

/** Close open payment follow-ups once the money is in. */
export async function closePaidFollowUps(customerId: number | null | undefined, saleIds: number[] = []) {
  try {
    if (!customerId && !saleIds.length) return;
    const open = await db.followUp.findMany({
      where: { status: "OPEN", type: "PAYMENT", OR: [...(customerId ? [{ customerId }] : []), ...(saleIds.length ? [{ refType: "Sale", refId: { in: saleIds } }] : [])] },
      select: { id: true, refType: true, refId: true },
    });
    for (const f of open) {
      if (f.refType !== "Sale" || !f.refId) continue;
      const s = await db.sale.findUnique({ where: { id: f.refId }, select: { total: true, returnedAmount: true, paidAmount: true, status: true } });
      if (!s || s.status === "CANCELLED" || round2(s.total - s.returnedAmount - s.paidAmount) <= 0.5) {
        await db.followUp.update({ where: { id: f.id }, data: { status: "DONE", outcome: s?.status === "CANCELLED" ? "Bill cancelled (closed automatically)" : "Paid in full (closed automatically)", doneAt: new Date() } });
      }
    }
  } catch (e) {
    console.error("[kpr] closing payment follow-ups failed", e);
  }
}

const sched = globalThis as unknown as { __kprWfLast?: number };

/** Birthday, warranty and inactive-customer rules. Safe to call often: runs at most once an hour unless forced. */
export async function runScheduledRules(force = false): Promise<number> {
  if (!force && sched.__kprWfLast && Date.now() - sched.__kprWfLast < 60 * 60 * 1000) return 0;
  sched.__kprWfLast = Date.now();
  let made = 0;
  try {
    const rules = await db.workflowRule.findMany({ where: { active: true, trigger: { in: ["BIRTHDAY", "WARRANTY_EXPIRING", "INACTIVE_CUSTOMER"] } } });
    const today = ymd();
    for (const r of rules) {
      if (r.trigger === "BIRTHDAY") {
        for (let d = 0; d <= Math.max(0, r.delayDays); d++) {
          const day = addDays(today, d);
          const custs = await db.customer.findMany({ where: { birthday: day.slice(5) }, select: { id: true, name: true } });
          for (const c of custs) {
            if (await createFromRule(r, { customerId: c.id, due: day, title: fill(r.title, { customer: c.name }), key: `r${r.id}:bday:${c.id}:${day.slice(0, 4)}` })) made++;
          }
        }
      } else if (r.trigger === "WARRANTY_EXPIRING") {
        const items = await db.saleItem.findMany({
          where: {
            warrantyUntil: { gte: new Date(), lte: new Date(Date.now() + Math.max(1, r.delayDays) * 864e5) },
            sale: { status: { not: "CANCELLED" }, customerId: { not: null } },
          },
          include: { sale: { select: { id: true, invoiceNo: true, customerId: true, vehicleId: true, customer: { select: { name: true } } } } },
          take: 500,
        });
        for (const i of items) {
          if (i.qty <= i.returnedQty || !i.sale.customerId) continue;
          const title = fill(r.title, { customer: i.sale.customer?.name, item: i.name, invoice: i.sale.invoiceNo });
          if (await createFromRule(r, { customerId: i.sale.customerId, vehicleId: i.sale.vehicleId, refType: "Sale", refId: i.sale.id, due: today, title, key: `r${r.id}:item:${i.id}` })) made++;
        }
      } else if (r.trigger === "INACTIVE_CUSTOMER") {
        const cutoff = new Date(Date.now() - Math.max(7, r.delayDays) * 864e5);
        const last = await db.sale.groupBy({ by: ["customerId"], where: { customerId: { not: null }, status: { not: "CANCELLED" } }, _max: { date: true, id: true } });
        const lapsed = last.filter((l) => l.customerId && l._max.date && l._max.date < cutoff).slice(0, 200);
        if (!lapsed.length) continue;
        const names = new Map((await db.customer.findMany({ where: { id: { in: lapsed.map((l) => l.customerId!) } }, select: { id: true, name: true } })).map((c) => [c.id, c.name]));
        for (const l of lapsed) {
          const title = fill(r.title, { customer: names.get(l.customerId!) });
          if (await createFromRule(r, { customerId: l.customerId!, due: today, title, key: `r${r.id}:inactive:${l.customerId}:${l._max.id}` })) made++;
        }
      }
    }
  } catch (e) {
    console.error("[kpr] scheduled workflows failed", e);
  }
  if (made) console.log(`[kpr] workflows created ${made} follow-ups`);
  return made;
}
