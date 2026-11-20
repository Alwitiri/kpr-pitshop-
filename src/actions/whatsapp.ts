"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { db } from "@/lib/db";
import { requireAction } from "@/lib/auth";
import { can, type Perm } from "@/lib/roles";
import { composeMessage, fillMessage } from "@/lib/whatsapp";
import { checkInternet } from "@/lib/internet";
import { WA_DEFAULTS, WA_KINDS, WA_LABEL, waPhone, waUrl, type WaKind } from "@/lib/wa-templates";
import { customerStats, segmentOf, SEGMENTS, type Segment } from "@/lib/crm";
import { audit, errMsg, getSettings, optInt, str, type ActionResult } from "@/lib/server-utils";

export type WaOpen = {
  ok?: { url: string; webUrl: string; phone: string; text: string };
  /** No internet: the message was saved to send later (id of the waiting message). */
  queued?: number;
  /** Offers are paused while the shop has no internet. */
  offline?: boolean;
  needPhone?: boolean;
  error?: string;
};

/** Who may send which message (any one of the listed permissions is enough). */
const KIND_PERMS: Record<WaKind, Perm[]> = {
  INVOICE: ["pos", "sales"],
  PAYMENT_DUE: ["customers", "followups", "sales"],
  VEHICLE_READY: ["jobcards", "followups", "customers"],
  SERVICE_DUE: ["customers", "followups", "jobcards"],
  WARRANTY: ["customers", "followups"],
  BIRTHDAY: ["customers", "followups"],
  FEEDBACK: ["customers", "followups", "sales"],
  WIN_BACK: ["customers", "followups"],
  GENERAL: ["customers", "followups", "jobcards", "sales"],
  OFFER: ["whatsapp"],
};

async function noteOpened(s: { uid: number; name: string }, customerId: number | null, kind: string) {
  if (!customerId) return;
  await db.customerInteraction.create({
    data: { customerId, type: "WHATSAPP", note: `WhatsApp: ${WA_LABEL[kind as WaKind] ?? kind}`, userId: s.uid, userName: s.name },
  });
}

async function logSend(
  s: { uid: number; name: string },
  m: { kind: string; phone: string; text: string; customerId: number | null; saleId?: number | null; jobCardId?: number | null; followUpId?: number | null; campaignId?: number | null },
  queued = false,
) {
  const row = await db.waMessage.create({
    data: {
      customerId: m.customerId, phone: m.phone, kind: m.kind, body: m.text, saleId: m.saleId ?? null, jobCardId: m.jobCardId ?? null,
      followUpId: m.followUpId ?? null, campaignId: m.campaignId ?? null, userId: s.uid, userName: s.name,
      status: queued ? "QUEUED" : "OPENED", openedAt: queued ? null : new Date(),
    },
  });
  if (!queued) await noteOpened(s, m.customerId, m.kind);
  return row.id;
}

function links(phone: string, text: string, mode: string) {
  return { url: waUrl(phone, text, mode), webUrl: waUrl(phone, text, "WEB"), phone, text };
}

/**
 * Builds the message, records it, and returns the link that opens WhatsApp with it.
 * Staff press Send in WhatsApp – nothing is sent from here.
 */
export async function prepareWhatsApp(input: {
  kind: WaKind;
  customerId?: number | null;
  saleId?: number | null;
  jobCardId?: number | null;
  followUpId?: number | null;
  phone?: string | null;
  /** Open even though the shop PC has no internet (e.g. a phone on mobile data). */
  force?: boolean;
}): Promise<WaOpen> {
  try {
    const s = await requireAction();
    if (!WA_LABEL[input.kind]) return { error: "Unknown message type." };
    if (!KIND_PERMS[input.kind].some((p) => can(s.role, p))) return { error: "You do not have permission to send this message." };
    const settings = await getSettings();
    if (input.phone && !waPhone(input.phone, settings.waCountryCode)) return { error: "That mobile number does not look right.", needPhone: true };
    const m = await composeMessage(input);
    if (!m.phone) return { needPhone: true };
    const msg = { kind: input.kind, phone: m.phone, text: m.text, customerId: m.customerId, saleId: m.saleId, jobCardId: m.jobCardId, followUpId: input.followUpId };
    // No internet: keep the message so nobody has to remember it – it waits in WhatsApp → Waiting.
    if (!input.force && !(await checkInternet())) {
      const id = await logSend(s, msg, true);
      revalidatePath("/whatsapp");
      return { queued: id };
    }
    await logSend(s, msg);
    if (m.customerId) revalidatePath(`/customers/${m.customerId}`);
    return { ok: links(m.phone, m.text, settings.waOpenWith) };
  } catch (e) {
    return { error: errMsg(e) };
  }
}

// ── Offer broadcasts ──

/** Opted-in customers with a WhatsApp number matching the filters. */
async function audienceFor(f: { segment?: string; vtype?: string; make?: string; tag?: string; inactive?: number }) {
  const customers = await db.customer.findMany({
    where: {
      whatsappOptIn: true,
      phone: { not: null },
      ...(f.tag ? { tags: { contains: f.tag } } : {}),
      ...(f.vtype || f.make
        ? { vehicles: { some: { ...(f.vtype ? { type: f.vtype } : {}), ...(f.make ? { make: { contains: f.make } } : {}) } } }
        : {}),
    },
    select: { id: true, name: true, phone: true },
    orderBy: { name: "asc" },
  });
  if (!f.segment && !f.inactive) return customers;
  const stats = await customerStats(customers.map((c) => c.id));
  const now = Date.now();
  return customers.filter((c) => {
    const st = stats.get(c.id);
    if (f.segment && segmentOf(st, now) !== f.segment) return false;
    if (f.inactive && st?.last && now - st.last.getTime() < f.inactive * 864e5) return false;
    return true;
  });
}

function filtersFrom(fd: FormData) {
  return {
    segment: str(fd, "segment") || undefined,
    vtype: str(fd, "vtype") || undefined,
    make: str(fd, "make") || undefined,
    tag: str(fd, "tag") || undefined,
    inactive: optInt(fd, "inactive") ?? undefined,
  };
}

export async function previewAudience(fd: FormData) {
  await requireAction("whatsapp");
  const list = await audienceFor(filtersFrom(fd));
  return { count: list.length, sample: list.slice(0, 8).map((c) => c.name) };
}

export async function createCampaign(_: ActionResult, fd: FormData): Promise<ActionResult> {
  let id = 0;
  try {
    const s = await requireAction("whatsapp");
    const name = str(fd, "name");
    const body = str(fd, "body");
    if (!name || !body) return { error: "Give the offer a name and write the message." };
    if (body.includes("[write the offer here]")) return { error: "Replace “[write the offer here]” with your offer." };
    const f = filtersFrom(fd);
    const people = await audienceFor(f);
    if (!people.length) return { error: "No opted-in customers match these filters." };
    const settings = await getSettings();
    const audience = [
      f.segment && `Segment: ${SEGMENTS[f.segment as Segment]?.label ?? f.segment}`,
      f.vtype && (f.vtype === "CAR" ? "Car owners" : "Bike owners"),
      f.make && `Make: ${f.make}`,
      f.tag && `Tag: ${f.tag}`,
      f.inactive && `Not visited ${f.inactive}+ days`,
    ].filter(Boolean).join(" · ") || "All opted-in customers";
    const c = await db.waCampaign.create({
      data: {
        name, body, audience, createdById: s.uid,
        recipients: {
          create: people
            .map((p) => ({ customerId: p.id, name: p.name, phone: waPhone(p.phone, settings.waCountryCode) }))
            .filter((p): p is { customerId: number; name: string; phone: string } => !!p.phone),
        },
      },
    });
    id = c.id;
    await audit(s.uid, "WA_CAMPAIGN_CREATED", "WaCampaign", id, `${name} – ${people.length} customers`);
  } catch (e) {
    return { error: errMsg(e) };
  }
  revalidatePath("/whatsapp");
  redirect(`/whatsapp/${id}`);
}

/** Opens WhatsApp for one recipient of an offer and marks them sent. */
export async function sendCampaignRecipient(recipientId: number, force = false): Promise<WaOpen> {
  try {
    const s = await requireAction("whatsapp");
    const r = await db.waCampaignRecipient.findUnique({ where: { id: recipientId }, include: { campaign: true } });
    if (!r) return { error: "Not found." };
    if (!force && !(await checkInternet())) return { offline: true, error: "No internet on the shop PC – offers are paused until it is back." };
    const settings = await getSettings();
    const m = await composeMessage({ kind: "OFFER", customerId: r.customerId, body: r.campaign.body, phone: r.phone });
    const phone = m.phone ?? r.phone;
    await db.waCampaignRecipient.update({ where: { id: r.id }, data: { status: "SENT", sentAt: new Date(), sentById: s.uid } });
    await logSend(s, { kind: "OFFER", phone, text: m.text, customerId: r.customerId, campaignId: r.campaignId });
    revalidatePath(`/whatsapp/${r.campaignId}`);
    return { ok: links(phone, m.text, settings.waOpenWith) };
  } catch (e) {
    return { error: errMsg(e) };
  }
}

export async function setRecipientStatus(recipientId: number, status: "PENDING" | "SKIPPED" | "OPTED_OUT") {
  const s = await requireAction("whatsapp");
  const r = await db.waCampaignRecipient.update({ where: { id: recipientId }, data: { status, sentAt: null } });
  if (status === "OPTED_OUT" && r.customerId) {
    await db.customer.update({ where: { id: r.customerId }, data: { whatsappOptIn: false, optInAt: null, optInSource: null } });
    await db.customerInteraction.create({ data: { customerId: r.customerId, type: "WHATSAPP", note: "Asked to stop WhatsApp offers – consent removed", userId: s.uid, userName: s.name } });
    await audit(s.uid, "WA_OPT_OUT", "Customer", r.customerId, r.name);
  }
  revalidatePath(`/whatsapp/${r.campaignId}`);
}

export async function deleteCampaign(fd: FormData) {
  const s = await requireAction("whatsapp");
  const id = Number(fd.get("id"));
  const c = await db.waCampaign.delete({ where: { id } });
  await audit(s.uid, "WA_CAMPAIGN_DELETED", "WaCampaign", id, c.name);
  revalidatePath("/whatsapp");
  redirect("/whatsapp");
}

// ── Settings & wording ──

export async function saveWaSettings(_: ActionResult, fd: FormData): Promise<ActionResult> {
  try {
    const s = await requireAction("whatsapp");
    const mode = str(fd, "waOpenWith");
    const cc = str(fd, "waCountryCode").replace(/\D/g, "");
    if (!cc || cc.length > 4) return { error: "Enter the country code, e.g. 91 for India." };
    await db.shopSettings.update({ where: { id: 1 }, data: { waOpenWith: ["APP", "WEB", "LINK"].includes(mode) ? mode : "APP", waCountryCode: cc } });
    for (const k of WA_KINDS) {
      const body = String(fd.get(`t_${k.key}`) ?? "").replace(/\r\n/g, "\n").trim();
      if (!body || body === WA_DEFAULTS[k.key]) await db.waTemplate.deleteMany({ where: { key: k.key } });
      else await db.waTemplate.upsert({ where: { key: k.key }, create: { key: k.key, body }, update: { body } });
    }
    await audit(s.uid, "WA_SETTINGS_SAVED", "WaTemplate", null);
    revalidatePath("/whatsapp/settings");
    return { ok: "WhatsApp settings saved." };
  } catch (e) {
    return { error: errMsg(e) };
  }
}

/** Live preview of a template with sample data (Settings screen). */
export async function previewTemplate(body: string) {
  await requireAction("whatsapp");
  const settings = await getSettings();
  return fillMessage(body, {
    customer: "Arun Kumar", shop: settings.shopName, shop_phone: settings.phone || "98765 43210", invoice: `${settings.invoicePrefix}-00123`,
    date: "20 Nov 2026", items: "• Steelbird SBA-1 Helmet – ₹1,650.00\n• Chain lube × 2 – ₹500.00", total: "₹2,150.00", paid: "₹1,500.00",
    due: "₹650.00", due_line: "\n*Balance due: ₹650.00*", upi_line: settings.upiId ? `\nPay by UPI: ${settings.upiId}` : "",
    vehicle: "Royal Enfield Classic 350 TN37AB1234", job: "JOB-00042", item: "Exide battery", footer: settings.invoiceFooter ?? "",
  });
}

// ── Waiting for internet ──

/** Open a message that was saved while the internet was down. */
export async function openQueued(id: number): Promise<WaOpen> {
  try {
    const s = await requireAction();
    const m = await db.waMessage.findUnique({ where: { id } });
    if (!m || m.status !== "QUEUED") return { error: "Already opened or removed." };
    if (!KIND_PERMS[m.kind as WaKind]?.some((p) => can(s.role, p))) return { error: "You do not have permission to send this message." };
    const settings = await getSettings();
    await db.waMessage.update({ where: { id }, data: { status: "OPENED", openedAt: new Date(), userId: s.uid, userName: s.name } });
    await noteOpened(s, m.customerId, m.kind);
    revalidatePath("/whatsapp");
    return { ok: links(m.phone, m.body, settings.waOpenWith) };
  } catch (e) {
    return { error: errMsg(e) };
  }
}

export async function removeQueued(id: number) {
  await requireAction();
  await db.waMessage.updateMany({ where: { id, status: "QUEUED" }, data: { status: "REMOVED" } });
  revalidatePath("/whatsapp");
}
