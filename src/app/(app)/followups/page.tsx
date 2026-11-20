import Link from "next/link";
import type { Prisma } from "@prisma/client";
import { db } from "@/lib/db";
import { requirePage } from "@/lib/auth";
import { can } from "@/lib/roles";
import { customerDues } from "@/lib/queries";
import { addDays, dayRange, monthStart, ymd } from "@/lib/format";
import { runScheduledRules } from "@/lib/workflows";
import { Empty, PageHeader, Section, Stat } from "@/components/ui";
import { FOLLOWUP_LABEL, FollowUpRows, NewFollowUpForm } from "@/components/followups";

export const metadata = { title: "Follow-ups" };

const VIEWS: [string, string][] = [["due", "Due now"], ["upcoming", "Upcoming"], ["done", "Done"], ["all", "All"]];

export default async function FollowUpsPage({ searchParams }: { searchParams: Promise<Record<string, string | undefined>> }) {
  const s = await requirePage("followups");
  await runScheduledRules(); // birthdays, warranties… (at most once an hour)
  const sp = await searchParams;
  const view = sp.view ?? "due";
  const today = ymd();
  const endToday = dayRange(today).lte;
  const startToday = dayRange(today).gte;

  const where: Prisma.FollowUpWhereInput = {};
  if (view === "due") Object.assign(where, { status: "OPEN", dueDate: { lte: endToday } });
  if (view === "upcoming") Object.assign(where, { status: "OPEN", dueDate: { gt: endToday } });
  if (view === "done") where.status = { in: ["DONE", "SKIPPED"] };
  if (sp.type) where.type = sp.type;
  if (sp.who === "me") where.OR = [{ assignedToId: s.uid }, { assignedToId: null }];

  const [items, overdue, dueToday, week, doneMonth, staff, dues] = await Promise.all([
    db.followUp.findMany({
      where,
      include: { customer: { select: { id: true, name: true, phone: true } }, assignedTo: { select: { name: true } }, rule: { select: { name: true } } },
      orderBy: view === "done" ? { doneAt: "desc" } : { dueDate: "asc" },
      take: 300,
    }),
    db.followUp.count({ where: { status: "OPEN", dueDate: { lt: startToday } } }),
    db.followUp.count({ where: { status: "OPEN", dueDate: dayRange(today) } }),
    db.followUp.count({ where: { status: "OPEN", dueDate: { gt: endToday, lte: dayRange(addDays(today, 7)).lte } } }),
    db.followUp.count({ where: { status: "DONE", doneAt: dayRange(monthStart(), today) } }),
    db.user.findMany({ where: { active: true }, select: { id: true, name: true }, orderBy: { name: "asc" } }),
    can(s.role, "customers") ? customerDues() : Promise.resolve([]),
  ]);
  const dueMap = new Map(dues.map((d) => [d.id, d.due]));
  const rows = items.map((f) => ({ ...f, due: f.type === "PAYMENT" && f.customer ? dueMap.get(f.customer.id) ?? 0 : undefined }));
  const link = (o: Record<string, string | undefined>) => {
    const u = new URLSearchParams();
    for (const [k, v] of Object.entries({ view, type: sp.type, who: sp.who, ...o })) if (v) u.set(k, v);
    return `/followups?${u}`;
  };

  return (
    <>
      <PageHeader
        title="Follow-ups"
        subtitle="Who to call today – feedback, payments, service reminders, birthdays"
        actions={can(s.role, "settings") ? <Link href="/settings/workflows" className="btn-outline">Automation rules</Link> : undefined}
      />
      <div className="mb-5 grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Stat label="Overdue" value={overdue} tone={overdue ? "bad" : "good"} href={link({ view: "due" })} />
        <Stat label="Due today" value={dueToday} tone={dueToday ? "warn" : "default"} href={link({ view: "due" })} />
        <Stat label="Next 7 days" value={week} href={link({ view: "upcoming" })} />
        <Stat label="Done this month" value={doneMonth} tone="good" href={link({ view: "done" })} />
      </div>
      <div className="grid gap-5 xl:grid-cols-[1fr_360px]">
        <div>
          <div className="mb-3 flex flex-wrap items-center gap-1.5">
            {VIEWS.map(([k, l]) => <Link key={k} href={link({ view: k })} className={k === view ? "btn-dark btn-sm" : "btn-outline btn-sm"}>{l}</Link>)}
            <span className="mx-1 h-5 w-px bg-gray-200" />
            <Link href={link({ who: sp.who === "me" ? undefined : "me" })} className={sp.who === "me" ? "btn-dark btn-sm" : "btn-outline btn-sm"}>Mine</Link>
            <form className="flex items-center gap-1.5" method="get">
              <input type="hidden" name="view" value={view} />
              {sp.who && <input type="hidden" name="who" value={sp.who} />}
              <select name="type" defaultValue={sp.type ?? ""} className="input py-1 text-xs" aria-label="Type">
                <option value="">All types</option>
                {Object.entries(FOLLOWUP_LABEL).map(([k, l]) => <option key={k} value={k}>{l}</option>)}
              </select>
              <button className="btn-outline btn-sm">Filter</button>
            </form>
          </div>
          <div className="card">
            <FollowUpRows items={rows} today={today} />
            {!rows.length && <Empty>{view === "due" ? "Nothing due – all caught up." : "No follow-ups here."}</Empty>}
          </div>
        </div>
        <div className="space-y-5">
          <Section title="Add a follow-up">
            <NewFollowUpForm staff={staff} today={today} />
          </Section>
          <Section title="How this works">
            <ul className="list-disc space-y-1.5 pl-4 text-sm text-gray-600">
              <li><b>Automation rules</b> create follow-ups by themselves: feedback calls after a bill, payment reminders, “vehicle ready”, next service, birthdays, ending warranties.</li>
              <li>Press <b>Done</b> and write what the customer said. It is saved in the customer&apos;s history.</li>
              <li>Payment follow-ups close themselves when the bill is fully paid.</li>
            </ul>
          </Section>
        </div>
      </div>
    </>
  );
}
