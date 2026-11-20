import "server-only";
import { db } from "./db";
import { getSettings } from "./server-utils";
import { checkInternet } from "./internet";
import { composeMessage } from "./whatsapp";
import { WA_LABEL, type WaKind } from "./wa-templates";

/**
 * Automatic sending through the official WhatsApp Cloud API (Meta).
 * Optional – the default stays "click to send". Everything goes through a queue in the
 * database (WaMessage status QUEUED, channel CLOUD), so messages made while the internet
 * is down, or scheduled for later (reminders), are sent by the background sender.
 *
 * KPR_WA_CLOUD_MOCK=1 pretends to be Meta (for testing without a Meta account):
 * messages containing "FAILTEST" fail like a real "no 24-hour window" error.
 */
const MOCK = () => process.env.KPR_WA_CLOUD_MOCK === "1";

export type CloudTemplate = { name: string; language: string; status: string; category: string; params: number; body: string };

export async function cloudConfig() {
  const s = await getSettings();
  const ready = !!(s.waCloudPhoneId && s.waCloudToken);
  return {
    on: s.waMode === "CLOUD" && (ready || MOCK()),
    ready: ready || MOCK(),
    phoneId: s.waCloudPhoneId,
    wabaId: s.waCloudWabaId,
    token: s.waCloudToken,
    version: (s.waCloudVersion || "v22.0").replace(/[^v0-9.]/g, ""),
    autoInvoice: s.waAutoInvoice,
    templates: (() => {
      try {
        return JSON.parse(s.waCloudTemplates || "[]") as CloudTemplate[];
      } catch {
        return [];
      }
    })(),
  };
}

type CloudResult = { ok: true; id: string } | { ok: false; error: string; retry: boolean };

/** Meta error codes in words the shop understands. */
function explain(code: number | undefined, msg: string): { error: string; retry: boolean } {
  switch (code) {
    case 131047:
      return { error: "This customer has not messaged the shop in the last 24 hours, so WhatsApp only allows an approved template. Choose a template for this message in WhatsApp settings.", retry: false };
    case 131026:
    case 133010:
      return { error: "This number is not on WhatsApp (or cannot receive messages).", retry: false };
    case 131030:
      return { error: "Meta test mode: this number is not in the allowed test list. Add it in Meta Business, or use the shop's live number.", retry: false };
    case 132000:
      return { error: "The template expects a different number of fill-ins. Check the fill-ins for this message in WhatsApp settings.", retry: false };
    case 132001:
      return { error: "That template name / language does not exist or is not approved yet.", retry: false };
    case 132018:
      return { error: "A fill-in value was rejected (WhatsApp does not allow line breaks in template fill-ins).", retry: false };
    case 190:
      return { error: "The access token has expired or is wrong. The owner must paste a new token in WhatsApp settings.", retry: false };
    case 131048:
      return { error: "WhatsApp limited this number because too many people blocked or reported it. Pause offers for a while.", retry: false };
    case 130429:
    case 131056:
    case 80007:
      return { error: "WhatsApp is limiting how fast this number can send – it will retry automatically.", retry: true };
    default:
      return { error: `WhatsApp said: ${msg}`, retry: !code || code >= 500 };
  }
}

async function graph(path: string, init: { method?: string; token: string; version: string; body?: unknown }) {
  const res = await fetch(`https://graph.facebook.com/${init.version}/${path}`, {
    method: init.method ?? "GET",
    headers: { Authorization: `Bearer ${init.token}`, "Content-Type": "application/json" },
    body: init.body ? JSON.stringify(init.body) : undefined,
    signal: AbortSignal.timeout(15_000),
    cache: "no-store",
  });
  const json = (await res.json().catch(() => ({}))) as { error?: { code?: number; message?: string; error_data?: { details?: string } } } & Record<string, unknown>;
  return { res, json };
}

/** Template fill-ins may not contain new lines, tabs or more than 4 spaces in a row. */
const cleanParam = (v: string | undefined) =>
  (v ?? "").replace(/\*/g, "").replace(/[\r\n\t]+/g, " · ").replace(/ {4,}/g, "   ").replace(/^ · | · $/g, "").trim().slice(0, 1000) || "-";

/** Sends one message. Uses the approved template mapped to this kind, otherwise plain text (24-hour window only). */
export async function cloudSend(to: string, kind: WaKind, text: string, vars: Record<string, string | undefined>): Promise<CloudResult> {
  const cfg = await cloudConfig();
  const map = await db.waTemplate.findUnique({ where: { key: kind } });
  const payload: Record<string, unknown> = { messaging_product: "whatsapp", recipient_type: "individual", to };
  if (map?.cloudTemplate) {
    const keys = (map.cloudParams ?? "").split(",").map((k) => k.trim().replace(/[{}]/g, "")).filter(Boolean);
    payload.type = "template";
    payload.template = {
      name: map.cloudTemplate,
      language: { code: map.cloudLang || "en" },
      ...(keys.length ? { components: [{ type: "body", parameters: keys.map((k) => ({ type: "text", text: cleanParam(vars[k]) })) }] } : {}),
    };
  } else {
    payload.type = "text";
    payload.text = { body: text.slice(0, 4096), preview_url: false };
  }

  if (MOCK()) {
    console.log("[kpr] WhatsApp test mode – would send:", JSON.stringify(payload));
    await new Promise((r) => setTimeout(r, 150));
    if (text.includes("FAILTEST")) return { ok: false, ...explain(131047, "Re-engagement message") };
    return { ok: true, id: `wamid.MOCK${Date.now()}${Math.floor(Math.random() * 1000)}` };
  }
  if (!cfg.ready || !cfg.phoneId || !cfg.token) return { ok: false, error: "Automatic WhatsApp is not set up (Phone number ID and access token are needed).", retry: false };
  try {
    const { res, json } = await graph(`${cfg.phoneId}/messages`, { method: "POST", token: cfg.token, version: cfg.version, body: payload });
    const id = (json.messages as { id?: string }[] | undefined)?.[0]?.id;
    if (res.ok && id) return { ok: true, id };
    return { ok: false, ...explain(json.error?.code, json.error?.error_data?.details || json.error?.message || `HTTP ${res.status}`) };
  } catch (e) {
    return { ok: false, error: `Could not reach WhatsApp (${e instanceof Error ? e.message : "network"}) – will retry.`, retry: true };
  }
}

export async function cloudTest(): Promise<{ ok: boolean; text: string }> {
  const cfg = await cloudConfig();
  if (MOCK()) return { ok: true, text: "Connected (test mode) – Mock Shop · +91 90000 00000" };
  if (!cfg.phoneId || !cfg.token) return { ok: false, text: "Enter the Phone number ID and access token first." };
  try {
    const { res, json } = await graph(`${cfg.phoneId}?fields=display_phone_number,verified_name,quality_rating`, { token: cfg.token, version: cfg.version });
    if (!res.ok) return { ok: false, text: explain(json.error?.code, json.error?.message ?? `HTTP ${res.status}`).error };
    return { ok: true, text: `Connected – ${json.verified_name ?? "?"} · ${json.display_phone_number ?? "?"}${json.quality_rating ? ` · quality ${json.quality_rating}` : ""}` };
  } catch (e) {
    return { ok: false, text: `Could not reach WhatsApp: ${e instanceof Error ? e.message : "network error"}` };
  }
}

/** Approved templates from Meta, saved so the mapping dropdowns work offline too. */
export async function cloudLoadTemplates(): Promise<{ ok: boolean; text: string; count?: number }> {
  const cfg = await cloudConfig();
  let list: CloudTemplate[] = [];
  if (MOCK()) {
    list = [
      { name: "bill_summary", language: "en", status: "APPROVED", category: "UTILITY", params: 3, body: "Hello {{1}}, thank you for shopping with us. Bill {{2}}, total {{3}}." },
      { name: "payment_reminder", language: "en", status: "APPROVED", category: "UTILITY", params: 2, body: "Hello {{1}}, {{2}} is pending on your account." },
      { name: "vehicle_ready", language: "en", status: "APPROVED", category: "UTILITY", params: 3, body: "Hello {{1}}, your {{2}} is ready for pickup ({{3}})." },
      { name: "festival_offer", language: "en", status: "APPROVED", category: "MARKETING", params: 1, body: "Hello {{1}}! Our festival offer is live – visit us this week." },
    ];
  } else {
    if (!cfg.wabaId || !cfg.token) return { ok: false, text: "Enter the WhatsApp Business Account ID and access token first." };
    try {
      let url = `${cfg.wabaId}/message_templates?fields=name,language,status,category,components&limit=200`;
      for (let page = 0; page < 5 && url; page++) {
        const { res, json } = await graph(url, { token: cfg.token, version: cfg.version });
        if (!res.ok) return { ok: false, text: explain(json.error?.code, json.error?.message ?? `HTTP ${res.status}`).error };
        for (const t of (json.data as { name: string; language: string; status: string; category: string; components?: { type: string; text?: string }[] }[]) ?? []) {
          const body = t.components?.find((c) => c.type === "BODY")?.text ?? "";
          list.push({ name: t.name, language: t.language, status: t.status, category: t.category, body, params: new Set(body.match(/\{\{\d+\}\}/g) ?? []).size });
        }
        const next = (json.paging as { next?: string } | undefined)?.next;
        url = next ? next.replace(/^https:\/\/graph\.facebook\.com\/v[\d.]+\//, "") : "";
      }
    } catch (e) {
      return { ok: false, text: `Could not reach WhatsApp: ${e instanceof Error ? e.message : "network error"}` };
    }
  }
  await db.shopSettings.update({ where: { id: 1 }, data: { waCloudTemplates: JSON.stringify(list) } });
  const approved = list.filter((t) => t.status === "APPROVED").length;
  return { ok: true, text: `${list.length} templates loaded (${approved} approved).`, count: list.length };
}

// ── Queue ──

export type Enqueue = {
  kind: WaKind;
  customerId?: number | null;
  saleId?: number | null;
  jobCardId?: number | null;
  followUpId?: number | null;
  campaignId?: number | null;
  recipientId?: number | null;
  phone?: string | null;
  body?: string | null;
  sendAfter?: Date | null;
  userId?: number | null;
  userName?: string | null;
};

/** Saves an automatic message to the queue. Returns its id, or null when the customer has no WhatsApp number. */
export async function enqueueCloud(e: Enqueue) {
  const m = await composeMessage({ kind: e.kind, customerId: e.customerId, saleId: e.saleId, jobCardId: e.jobCardId, followUpId: e.followUpId, phone: e.phone, body: e.body });
  if (!m.phone) return null;
  const row = await db.waMessage.create({
    data: {
      channel: "CLOUD", status: "QUEUED", kind: e.kind, phone: m.phone, body: m.text, customerId: m.customerId,
      saleId: m.saleId, jobCardId: m.jobCardId, followUpId: e.followUpId ?? null, campaignId: e.campaignId ?? null,
      recipientId: e.recipientId ?? null, sendAfter: e.sendAfter ?? null, userId: e.userId ?? null, userName: e.userName ?? "Automatic",
    },
  });
  return row.id;
}

/** Sends one queued message now (re-building it so amounts and names are current). */
export async function sendQueuedNow(id: number): Promise<{ ok: boolean; error?: string; retry?: boolean }> {
  const m = await db.waMessage.findUnique({ where: { id } });
  if (!m || m.status !== "QUEUED" || m.channel !== "CLOUD") return { ok: false, error: "Already handled." };

  // A reminder that staff already dealt with by hand is no longer needed.
  if (m.followUpId) {
    const f = await db.followUp.findUnique({ where: { id: m.followUpId }, select: { status: true } });
    if (f && f.status !== "OPEN") {
      await db.waMessage.update({ where: { id }, data: { status: "REMOVED", error: "Follow-up was already done" } });
      return { ok: false, error: "Follow-up was already done." };
    }
  }
  const campaign = m.campaignId ? await db.waCampaign.findUnique({ where: { id: m.campaignId }, select: { body: true } }) : null;
  const fresh = await composeMessage({
    kind: m.kind as WaKind, customerId: m.customerId, saleId: m.saleId, jobCardId: m.jobCardId, followUpId: m.followUpId,
    phone: m.phone, body: campaign?.body ?? null,
  });
  const to = fresh.phone ?? m.phone;
  const r = await cloudSend(to, m.kind as WaKind, fresh.text, fresh.vars);
  const now = new Date();
  if (r.ok) {
    await db.waMessage.update({ where: { id }, data: { status: "SENT", waId: r.id, body: fresh.text, phone: to, openedAt: now, error: null, attempts: { increment: 1 } } });
    if (m.customerId) {
      await db.customerInteraction.create({
        data: { customerId: m.customerId, type: "WHATSAPP", note: `WhatsApp sent automatically: ${WA_LABEL[m.kind as WaKind] ?? m.kind}`, userId: m.userId, userName: m.userName ?? "Automatic" },
      });
    }
    if (m.followUpId) {
      await db.followUp.updateMany({ where: { id: m.followUpId, status: "OPEN" }, data: { status: "DONE", outcome: "Sent automatically on WhatsApp", doneAt: now } });
    }
    if (m.recipientId) await db.waCampaignRecipient.update({ where: { id: m.recipientId }, data: { status: "SENT", sentAt: now, error: null } }).catch(() => null);
    return { ok: true };
  }
  const attempts = m.attempts + 1;
  if (r.retry && attempts < 6) {
    // 2, 4, 8, 16, 32 minutes
    await db.waMessage.update({ where: { id }, data: { attempts, error: r.error, sendAfter: new Date(Date.now() + 2 ** attempts * 60_000) } });
    return { ok: false, error: r.error, retry: true };
  }
  await db.waMessage.update({ where: { id }, data: { status: "FAILED", attempts, error: r.error } });
  if (m.recipientId) await db.waCampaignRecipient.update({ where: { id: m.recipientId }, data: { status: "FAILED", error: r.error } }).catch(() => null);
  if (m.followUpId) {
    await db.followUp.updateMany({ where: { id: m.followUpId, status: "OPEN" }, data: { notes: `Automatic WhatsApp failed: ${r.error}` } });
  }
  return { ok: false, error: r.error };
}

const worker = globalThis as unknown as { __kprWaBusy?: boolean };

/** Background sender: runs every minute, sends due automatic messages when the internet is up. */
export async function processCloudQueue(limit = 30) {
  if (worker.__kprWaBusy) return 0;
  worker.__kprWaBusy = true;
  let sent = 0;
  try {
    const cfg = await cloudConfig();
    if (!cfg.on) return 0;
    if (!(await checkInternet())) return 0;
    const due = await db.waMessage.findMany({
      where: { channel: "CLOUD", status: "QUEUED", OR: [{ sendAfter: null }, { sendAfter: { lte: new Date() } }] },
      orderBy: { createdAt: "asc" },
      take: limit,
      select: { id: true },
    });
    for (const d of due) {
      const r = await sendQueuedNow(d.id);
      if (r.ok) sent++;
      // A steady pace keeps the number in good standing with WhatsApp.
      await new Promise((res) => setTimeout(res, 400));
    }
  } catch (e) {
    console.error("[kpr] WhatsApp sender failed", e);
  } finally {
    worker.__kprWaBusy = false;
  }
  if (sent) console.log(`[kpr] WhatsApp: sent ${sent} automatic messages`);
  return sent;
}

/** Start sending soon without making the caller wait (e.g. right after a bill). */
export function kickCloudQueue() {
  setTimeout(() => processCloudQueue().catch(() => null), 50);
}
