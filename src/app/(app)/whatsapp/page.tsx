import Link from "next/link";
import { db } from "@/lib/db";
import { requirePage } from "@/lib/auth";
import { dayRange, fmtDateTime, monthStart, ymd } from "@/lib/format";
import { WA_LABEL, waUrl, type WaKind } from "@/lib/wa-templates";
import { cloudConfig } from "@/lib/wa-cloud";
import { getSettings } from "@/lib/server-utils";
import { AutoList } from "./auto-list";
import { Empty, PageHeader, Section, Stat, TableWrap } from "@/components/ui";
import { WaGlyph } from "@/components/whatsapp-button";
import { WaitingList } from "./waiting-list";

export const metadata = { title: "WhatsApp" };

export default async function WhatsAppPage() {
  await requirePage("whatsapp");
  const today = ymd();
  const [cloud, settings] = await Promise.all([cloudConfig(), getSettings()]);
  const [optedIn, withPhone, sentToday, sentMonth, campaigns, counts, recent, waiting, auto, autoToday] = await Promise.all([
    db.customer.count({ where: { whatsappOptIn: true, phone: { not: null } } }),
    db.customer.count({ where: { phone: { not: null } } }),
    db.waMessage.count({ where: { status: { in: ["OPENED", "SENT"] }, openedAt: dayRange(today) } }),
    db.waMessage.count({ where: { status: { in: ["OPENED", "SENT"] }, openedAt: dayRange(monthStart(), today) } }),
    db.waCampaign.findMany({ orderBy: { createdAt: "desc" }, take: 30 }),
    db.waCampaignRecipient.groupBy({ by: ["campaignId", "status"], _count: true }),
    db.waMessage.findMany({ where: { status: { in: ["OPENED", "SENT"] } }, orderBy: { openedAt: "desc" }, take: 40, include: { customer: { select: { id: true, name: true } } } }),
    db.waMessage.findMany({ where: { status: "QUEUED", channel: "CLICK" }, orderBy: { createdAt: "asc" }, include: { customer: { select: { id: true, name: true } } } }),
    db.waMessage.findMany({
      where: { channel: "CLOUD", OR: [{ status: "QUEUED" }, { status: "FAILED", createdAt: { gte: new Date(Date.now() - 14 * 864e5) } }] },
      orderBy: [{ sendAfter: "asc" }, { createdAt: "asc" }],
      take: 200,
      include: { customer: { select: { id: true, name: true } } },
    }),
    db.waMessage.count({ where: { channel: "CLOUD", status: "SENT", openedAt: dayRange(today) } }),
  ]);
  const now = Date.now();
  const count = (id: number, st?: string) => counts.filter((c) => c.campaignId === id && (!st || c.status === st)).reduce((a, c) => a + c._count, 0);

  return (
    <>
      <PageHeader
        title="WhatsApp"
        subtitle={cloud.on ? "Automatic mode: bills, reminders and offers are sent by the software through the WhatsApp Cloud API" : "Free click-to-send: the app writes the message and opens WhatsApp – staff press Send"}
        actions={
          <>
            <Link href="/whatsapp/settings" className="btn-outline">Message wording & settings</Link>
            <Link href="/whatsapp/new" className="btn-primary">+ New offer</Link>
          </>
        }
      />
      <WaitingList
        items={waiting.map((m) => ({
          id: m.id, phone: m.phone, customer: m.customer, label: WA_LABEL[m.kind as WaKind] ?? m.kind,
          preview: m.body.replace(/\*/g, "").replace(/\n+/g, " · "), when: fmtDateTime(m.createdAt),
        }))}
      />
      {(cloud.on || auto.length > 0) && (
        <AutoList
          cloudOn={cloud.on}
          sentToday={autoToday}
          items={auto.map((m) => ({
            id: m.id, status: m.status as "QUEUED" | "FAILED", label: WA_LABEL[m.kind as WaKind] ?? m.kind, customer: m.customer, phone: m.phone,
            preview: m.body.replace(/\*/g, "").replace(/\n+/g, " · "), error: m.error,
            scheduled: m.status === "QUEUED" && !!m.sendAfter && m.sendAfter.getTime() > now && m.attempts === 0,
            when: m.status === "FAILED" ? `failed ${fmtDateTime(m.createdAt)}` : m.sendAfter && m.sendAfter.getTime() > now ? `sends ${fmtDateTime(m.sendAfter)}` : `waiting since ${fmtDateTime(m.createdAt)}`,
            clickUrl: waUrl(m.phone, m.body, settings.waOpenWith),
          }))}
        />
      )}
      <div className="mb-5 grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Stat label="Opted in for offers" value={optedIn} hint={`of ${withPhone} customers with a mobile`} tone="good" href="/customers?optin=yes" />
        <Stat label="Today" value={sentToday} hint={cloud.on ? "messages sent or opened" : "messages opened in WhatsApp"} />
        <Stat label="This month" value={sentMonth} />
        <Stat label="Offers" value={campaigns.length} hint="broadcast lists" />
      </div>

      <div className="grid gap-5 xl:grid-cols-[1fr_420px]">
        <Section title="Offers & broadcasts" pad={false}>
          <TableWrap>
            <table className="table">
              <thead><tr><th>Offer</th><th>Audience</th><th>Progress</th><th>Created</th></tr></thead>
              <tbody>
                {campaigns.map((c) => {
                  const total = count(c.id), sent = count(c.id, "SENT"), pending = count(c.id, "PENDING");
                  const pct = total ? Math.round(((total - pending) / total) * 100) : 0;
                  return (
                    <tr key={c.id}>
                      <td><Link className="link" href={`/whatsapp/${c.id}`}>{c.name}</Link></td>
                      <td className="max-w-56 text-xs text-gray-600">{c.audience}</td>
                      <td className="min-w-40">
                        <div className="flex items-center gap-2">
                          <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-gray-100"><div className="h-full rounded-full bg-emerald-500" style={{ width: `${pct}%` }} /></div>
                          <span className="whitespace-nowrap text-xs tabular-nums text-gray-600">{sent}/{total} sent</span>
                        </div>
                      </td>
                      <td className="whitespace-nowrap text-xs text-gray-600">{fmtDateTime(c.createdAt)}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </TableWrap>
          {!campaigns.length && (
            <Empty icon="chat" action={<Link href="/whatsapp/new" className="btn-primary btn-sm">Create the first offer</Link>}>
              Send an offer to a group of opted-in customers – for example all Royal Enfield owners, or customers who have not visited for 3 months.
            </Empty>
          )}
        </Section>

        <Section title="Recently opened in WhatsApp" pad={false}>
          <ul className="max-h-[560px] divide-y divide-gray-100 overflow-y-auto">
            {recent.map((m) => (
              <li key={m.id} className="flex items-start gap-3 px-4 py-2.5 sm:px-5">
                <span className="mt-0.5 grid h-7 w-7 shrink-0 place-items-center rounded-full bg-emerald-50 text-[#0a7d4f]"><WaGlyph className="h-3.5 w-3.5" /></span>
                <div className="min-w-0 flex-1">
                  <div className="text-sm">
                    {m.customer ? <Link className="link" href={`/customers/${m.customer.id}`}>{m.customer.name}</Link> : <span className="font-medium">+{m.phone}</span>}
                    <span className="ml-1.5 text-xs text-gray-500">{WA_LABEL[m.kind as WaKind] ?? m.kind}</span>
                    {m.channel === "CLOUD" && <span className="badge ml-1.5 bg-emerald-50 text-emerald-700" title="Sent automatically through the WhatsApp Cloud API">Auto</span>}
                  </div>
                  <div className="truncate text-xs text-gray-500" title={m.body}>{m.body.replace(/\*/g, "").replace(/\n+/g, " · ")}</div>
                </div>
                <span className="shrink-0 text-right text-[11px] text-gray-400">{fmtDateTime(m.openedAt ?? m.createdAt)}{m.userName && <div>{m.userName}</div>}</span>
              </li>
            ))}
            {!recent.length && <li><Empty icon="chat">Nothing sent yet. Use the WhatsApp buttons on bills, customers, job cards and follow-ups.</Empty></li>}
          </ul>
        </Section>
      </div>
      <p className="mt-4 text-xs text-gray-500">
        WhatsApp does not tell the app whether staff pressed Send, so this list shows messages <b>opened</b> in WhatsApp. Offers only go to customers who agreed to receive them.
      </p>
    </>
  );
}
