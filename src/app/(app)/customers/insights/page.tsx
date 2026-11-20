import Link from "next/link";
import { db } from "@/lib/db";
import { requirePage } from "@/lib/auth";
import { customerStats, SEGMENTS, SEGMENT_ORDER, segmentOf, type Segment } from "@/lib/crm";
import { addDays, dayRange, money, money0, ymd } from "@/lib/format";
import { PageHeader, Section, Stat, TableWrap } from "@/components/ui";
import { BarChart } from "@/components/bar-chart";

export const metadata = { title: "Customer insights" };

const WEEKDAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
const IST = 5.5 * 3600e3;

export default async function InsightsPage() {
  await requirePage("reports");
  const today = ymd();
  const now = Date.now();
  const from90 = addDays(today, -89);
  const from12m = `${addDays(today, -365).slice(0, 7)}-01`;

  const [customers, stats, sales90, sales12m, vehicles, fu30, users] = await Promise.all([
    db.customer.findMany({ select: { id: true, createdAt: true } }),
    customerStats(),
    db.sale.findMany({ where: { date: dayRange(from90, today), status: { not: "CANCELLED" } }, select: { date: true, total: true, returnedAmount: true } }),
    db.sale.findMany({
      where: { date: dayRange(from12m, today), status: { not: "CANCELLED" } },
      select: { date: true, total: true, returnedAmount: true, customerId: true, vehicle: { select: { make: true } } },
    }),
    db.vehicle.groupBy({ by: ["make"], _count: true }),
    db.followUp.findMany({ where: { createdAt: dayRange(addDays(today, -29), today) }, select: { status: true, doneById: true, dueDate: true } }),
    db.user.findMany({ select: { id: true, name: true } }),
  ]);

  // ── Segments ──
  const seg = new Map<Segment, { n: number; spent: number }>(SEGMENT_ORDER.map((k) => [k, { n: 0, spent: 0 }]));
  for (const c of customers) {
    const st = stats.get(c.id);
    const k = segmentOf(st, now);
    const row = seg.get(k)!;
    row.n++;
    row.spent += st?.spent ?? 0;
  }
  const buyers = [...stats.values()];
  const totalSpent = buyers.reduce((a, b) => a + b.spent, 0);
  const repeat = buyers.filter((b) => b.visits >= 2).length;
  const active90 = buyers.filter((b) => b.last && now - b.last.getTime() <= 90 * 864e5).length;

  // ── New vs returning revenue by month (12 months) ──
  const firstBill = new Map([...stats.entries()].map(([id, s]) => [id, s.first]));
  const months: string[] = [];
  for (let d = new Date(`${from12m}T12:00:00+05:30`); months.length < 13; d.setUTCMonth(d.getUTCMonth() + 1)) months.push(ymd(d).slice(0, 7));
  const byMonth = new Map(months.map((m) => [m, { newRev: 0, retRev: 0, walkIn: 0, newCust: 0 }]));
  for (const s of sales12m) {
    const m = byMonth.get(ymd(s.date).slice(0, 7));
    if (!m) continue;
    const v = s.total - s.returnedAmount;
    if (!s.customerId) m.walkIn += v;
    else {
      const f = firstBill.get(s.customerId);
      if (f && ymd(f).slice(0, 7) === ymd(s.date).slice(0, 7)) m.newRev += v;
      else m.retRev += v;
    }
  }
  for (const c of customers) {
    const m = byMonth.get(ymd(c.createdAt).slice(0, 7));
    if (m) m.newCust++;
  }
  const monthLabel = (m: string) => new Date(`${m}-15T12:00:00+05:30`).toLocaleDateString("en-IN", { month: "short", year: "2-digit" });

  // ── Busy hours & days (90 days) ──
  const hours = Array.from({ length: 24 }, () => 0);
  const days = Array.from({ length: 7 }, () => ({ n: 0, v: 0 }));
  for (const s of sales90) {
    const t = new Date(s.date.getTime() + IST);
    hours[t.getUTCHours()]++;
    days[t.getUTCDay()].n++;
    days[t.getUTCDay()].v += s.total - s.returnedAmount;
  }
  const firstHour = Math.max(0, Math.min(9, hours.findIndex((h) => h > 0)));
  const lastHour = Math.max(20, 23 - [...hours].reverse().findIndex((h) => h > 0));
  const hourChart = hours.slice(firstHour, lastHour + 1).map((n, i) => {
    const h = firstHour + i;
    const lbl = `${h % 12 || 12}${h < 12 ? "am" : "pm"}`;
    return { label: lbl, value: n, tip: `${lbl}–${(h + 1) % 12 || 12}${h + 1 < 12 || h + 1 === 24 ? "am" : "pm"}` };
  });
  const busiestHour = hours.indexOf(Math.max(...hours));
  const busiestDay = days.map((d, i) => [i, d.n] as const).sort((a, b) => b[1] - a[1])[0];

  // ── Vehicle makes ──
  const makeRev = new Map<string, number>();
  for (const s of sales12m) if (s.vehicle?.make) makeRev.set(s.vehicle.make, (makeRev.get(s.vehicle.make) ?? 0) + s.total - s.returnedAmount);
  const makes = vehicles
    .map((v) => ({ make: v.make, n: v._count, rev: makeRev.get(v.make) ?? 0 }))
    .sort((a, b) => b.n - a.n)
    .slice(0, 10);

  // ── Follow-up performance (30 days) ──
  const fuDone = fu30.filter((f) => f.status === "DONE").length;
  const fuOverdue = fu30.filter((f) => f.status === "OPEN" && f.dueDate < dayRange(today).gte).length;
  const byStaff = new Map<number, number>();
  for (const f of fu30) if (f.status === "DONE" && f.doneById) byStaff.set(f.doneById, (byStaff.get(f.doneById) ?? 0) + 1);
  const userName = new Map(users.map((u) => [u.id, u.name]));

  return (
    <>
      <PageHeader title="Customer insights" subtitle="Who your customers are, who is slipping away and when the shop is busiest" back="/customers" />
      <div className="mb-5 grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Stat label="Active customers" value={active90} hint="bought in the last 90 days" />
        <Stat label="Repeat customers" value={`${buyers.length ? Math.round((repeat / buyers.length) * 100) : 0}%`} hint={`${repeat} of ${buyers.length} came back`} tone="good" />
        <Stat label="Average lifetime value" value={money0(buyers.length ? totalSpent / buyers.length : 0)} hint="per customer who bought" />
        <Stat label="Visits per customer" value={buyers.length ? (buyers.reduce((a, b) => a + b.visits, 0) / buyers.length).toFixed(1) : "0"} />
      </div>

      <Section title="Customer segments" className="mb-5" pad={false}>
        <TableWrap>
          <table className="table">
            <thead><tr><th>Segment</th><th>Who</th><th className="text-right">Customers</th><th className="text-right">Lifetime spend</th><th>What to do</th><th /></tr></thead>
            <tbody>
              {SEGMENT_ORDER.map((k) => {
                const m = SEGMENTS[k];
                const r = seg.get(k)!;
                return (
                  <tr key={k}>
                    <td><span className={`badge ${m.cls}`}>{m.label}</span></td>
                    <td className="text-xs text-gray-600">{m.rule}</td>
                    <td className="text-right tabular-nums font-semibold">{r.n}</td>
                    <td className="text-right tabular-nums">{money0(r.spent)}{totalSpent > 0 && <span className="ml-1 text-xs text-gray-400">{Math.round((r.spent / totalSpent) * 100)}%</span>}</td>
                    <td className="max-w-72 text-xs text-gray-700">{m.action}</td>
                    <td>{r.n > 0 && <Link className="link text-xs" href={`/customers?segment=${k}`}>View list</Link>}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </TableWrap>
      </Section>

      <div className="mb-5 grid gap-5 lg:grid-cols-2 [&>*]:min-w-0">
        <Section title="New customers per month">
          <BarChart kind="count" data={months.map((m) => ({ label: monthLabel(m), value: byMonth.get(m)!.newCust, tip: `${monthLabel(m)} – new customers` }))} labelEvery={2} />
        </Section>
        <Section title="Bills by hour of day (last 90 days)">
          <BarChart kind="count" data={hourChart} labelEvery={2} />
          <p className="mt-2 text-xs text-gray-500">
            Busiest around <b>{busiestHour % 12 || 12} {busiestHour < 12 ? "am" : "pm"}</b>
            {busiestDay && busiestDay[1] > 0 && <> · busiest day <b>{WEEKDAYS[busiestDay[0]]}</b></>}. Keep more staff at the counter then.
          </p>
        </Section>
      </div>

      <div className="mb-5 grid gap-5 lg:grid-cols-2 [&>*]:min-w-0">
        <Section title="Sales by weekday (last 90 days)">
          <BarChart data={days.map((d, i) => ({ label: WEEKDAYS[i], value: Math.round(d.v), tip: `${WEEKDAYS[i]} · ${d.n} bills` }))} />
        </Section>
        <Section title="Top vehicle makes among customers" pad={false}>
          <table className="table">
            <thead><tr><th>Make</th><th className="text-right">Vehicles</th><th className="text-right">Sales (12 months)</th></tr></thead>
            <tbody>
              {makes.map((m) => (
                <tr key={m.make}>
                  <td><Link className="link" href={`/customers?make=${encodeURIComponent(m.make)}`}>{m.make}</Link></td>
                  <td className="text-right tabular-nums">{m.n}</td>
                  <td className="text-right tabular-nums">{money0(m.rev)}</td>
                </tr>
              ))}
              {!makes.length && <tr><td colSpan={3} className="text-sm text-gray-500">No vehicles recorded yet.</td></tr>}
            </tbody>
          </table>
        </Section>
      </div>

      <div className="grid gap-5 xl:grid-cols-[1fr_360px]">
        <Section title="New vs returning customers – sales by month" pad={false} className="min-w-0">
          <TableWrap>
            <table className="table">
              <thead><tr><th>Month</th><th className="text-right">New customers</th><th className="text-right">From first-time buyers</th><th className="text-right">From returning</th><th className="text-right">Walk-in</th></tr></thead>
              <tbody>
                {[...months].reverse().map((m) => {
                  const r = byMonth.get(m)!;
                  return (
                    <tr key={m}>
                      <td className="whitespace-nowrap">{monthLabel(m)}</td>
                      <td className="text-right tabular-nums">{r.newCust}</td>
                      <td className="text-right tabular-nums">{money(r.newRev)}</td>
                      <td className="text-right tabular-nums">{money(r.retRev)}</td>
                      <td className="text-right tabular-nums text-gray-500">{money(r.walkIn)}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </TableWrap>
        </Section>
        <Section title="Follow-ups – last 30 days">
          <div className="grid grid-cols-3 gap-2 text-center">
            <div><div className="text-2xl font-bold tabular-nums">{fu30.length}</div><div className="text-xs text-gray-500">created</div></div>
            <div><div className="text-2xl font-bold tabular-nums text-emerald-600">{fuDone}</div><div className="text-xs text-gray-500">done</div></div>
            <div><div className={`text-2xl font-bold tabular-nums ${fuOverdue ? "text-red-600" : ""}`}>{fuOverdue}</div><div className="text-xs text-gray-500">overdue</div></div>
          </div>
          {byStaff.size > 0 && (
            <ul className="mt-4 space-y-1 border-t pt-3 text-sm">
              {[...byStaff.entries()].sort((a, b) => b[1] - a[1]).map(([id, n]) => (
                <li key={id} className="flex justify-between"><span>{userName.get(id) ?? "—"}</span><span className="tabular-nums text-gray-600">{n} done</span></li>
              ))}
            </ul>
          )}
          <Link href="/followups" className="btn-outline mt-4 block text-center">Open follow-ups</Link>
        </Section>
      </div>
    </>
  );
}
