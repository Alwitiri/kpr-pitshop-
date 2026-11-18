import Link from "next/link";
import { db } from "@/lib/db";
import { requirePage } from "@/lib/auth";
import { can, canSeeProfit } from "@/lib/roles";
import { customerDues, supplierBalances } from "@/lib/queries";
import { soldItems, daysBetween } from "@/lib/reports";
import { addDays, dayRange, fmtDate, fmtDateTime, money, money0, monthStart, qty, ymd } from "@/lib/format";
import { label } from "@/lib/calc";
import { Badge, PageHeader, Section, Stat, TableWrap } from "@/components/ui";
import { BarChart } from "@/components/bar-chart";

export const metadata = { title: "Dashboard" };

export default async function Dashboard({ searchParams }: { searchParams: Promise<{ denied?: string }> }) {
  const s = await requirePage("dashboard");
  const denied = (await searchParams).denied;
  const today = ymd();
  const from30 = addDays(today, -29);
  const profit = canSeeProfit(s.role);

  // Technician: just their jobs
  if (s.role === "TECHNICIAN") {
    const jobs = await db.jobCard.findMany({
      where: { technicianId: s.uid, status: { in: ["RECEIVED", "INSPECTION", "IN_PROGRESS", "COMPLETED"] } },
      include: { vehicle: true, customer: { select: { name: true } } },
      orderBy: { receivedAt: "asc" },
    });
    return (
      <>
        <PageHeader title={`Hello, ${s.name}`} subtitle="Your open jobs" actions={<Link href="/jobcards" className="btn-primary">Job board</Link>} />
        <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
          {jobs.map((j) => (
            <Link key={j.id} href={`/jobcards/${j.id}`} className="card card-pad hover:shadow-md">
              <div className="flex justify-between"><span className="font-mono text-xs">{j.number}</span><Badge status={j.status} /></div>
              <div className="mt-1 font-semibold">{j.vehicle ? `${j.vehicle.make} ${j.vehicle.model ?? ""}` : j.customer.name}</div>
              <div className="text-sm text-gray-600">{j.complaint}</div>
            </Link>
          ))}
          {!jobs.length && <p className="text-sm text-gray-500">No open jobs assigned to you.</p>}
        </div>
      </>
    );
  }

  const showMoney = can(s.role, "sales");
  const [items30, todaySales, monthAgg, products, recent, dues, suppliers, openJobs, expensesMonth, warrantiesSoon, todayPays] = await Promise.all([
    showMoney ? soldItems(from30, today) : Promise.resolve([]),
    db.sale.aggregate({ where: { date: dayRange(today), status: { not: "CANCELLED" } }, _sum: { total: true, returnedAmount: true }, _count: true }),
    db.sale.aggregate({ where: { date: dayRange(monthStart(), today), status: { not: "CANCELLED" } }, _sum: { total: true, returnedAmount: true }, _count: true }),
    db.product.findMany({ where: { active: true }, select: { id: true, name: true, stock: true, minStock: true, size: true } }),
    showMoney ? db.sale.findMany({ orderBy: { date: "desc" }, take: 8, include: { user: { select: { name: true } } } }) : Promise.resolve([]),
    can(s.role, "customers") ? customerDues() : Promise.resolve([]),
    can(s.role, "suppliers") ? supplierBalances() : Promise.resolve([]),
    db.jobCard.findMany({ where: { status: { in: ["RECEIVED", "INSPECTION", "IN_PROGRESS", "COMPLETED"] } }, select: { id: true, number: true, status: true, promisedAt: true, complaint: true } }),
    profit ? db.expense.aggregate({ where: { date: dayRange(monthStart(), today) }, _sum: { amount: true } }) : Promise.resolve(null),
    db.saleItem.findMany({
      where: { warrantyUntil: { gte: new Date(), lte: new Date(Date.now() + 30 * 864e5) }, sale: { status: { not: "CANCELLED" } } },
      include: { sale: { select: { id: true, customerName: true, customerPhone: true } } },
      take: 10,
      orderBy: { warrantyUntil: "asc" },
    }),
    db.payment.aggregate({ where: { date: dayRange(today) }, _sum: { amount: true } }),
  ]);

  const low = products.filter((p) => p.stock > 0 && p.stock <= p.minStock);
  const out = products.filter((p) => p.stock <= 0);
  const todayItems = items30.filter((i) => i.day === today);
  const monthItems = items30.filter((i) => i.day >= monthStart());
  const todayProfit = todayItems.reduce((a, i) => a + i.profit, 0);
  const monthProfit = monthItems.reduce((a, i) => a + i.profit, 0);
  const custDue = dues.reduce((a, d) => a + d.due, 0);
  const suppDue = suppliers.reduce((a, d) => a + Math.max(0, d.balance), 0);

  const byDay = new Map<string, number>();
  for (const i of items30) byDay.set(i.day, (byDay.get(i.day) ?? 0) + i.gross);
  const chart = daysBetween(from30, today).map((d) => ({
    label: d.slice(8),
    value: Math.round(byDay.get(d) ?? 0),
    tip: fmtDate(`${d}T12:00:00+05:30`),
  }));

  const topMap = new Map<string, { name: string; qty: number; value: number }>();
  for (const i of monthItems) {
    if (!i.productId) continue;
    const r = topMap.get(String(i.productId)) ?? { name: i.name, qty: 0, value: 0 };
    r.qty += i.netQty;
    r.value += i.gross;
    topMap.set(String(i.productId), r);
  }
  const top = [...topMap.entries()].sort((a, b) => b[1].qty - a[1].qty).slice(0, 8);
  const overdueJobs = openJobs.filter((j) => j.promisedAt && j.promisedAt < new Date());

  return (
    <>
      <PageHeader
        title={`Good ${greeting()}, ${s.name}`}
        subtitle={fmtDate(new Date())}
        actions={can(s.role, "pos") ? <Link href="/pos" className="btn-primary">+ New bill</Link> : undefined}
      />
      {denied && <div className="mb-4 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-800">You don&apos;t have access to “{denied}”. Ask the owner if you need it.</div>}

      <div className="mb-5 grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-6">
        {showMoney && <Stat label="Today's sales" value={money0((todaySales._sum.total ?? 0) - (todaySales._sum.returnedAmount ?? 0))} hint={`${todaySales._count} bills · collected ${money0(todayPays._sum.amount)}`} href="/sales" />}
        {profit && <Stat label="Today's profit (est.)" value={money0(todayProfit)} tone="good" hint="before expenses" />}
        {showMoney && <Stat label="This month" value={money0((monthAgg._sum.total ?? 0) - (monthAgg._sum.returnedAmount ?? 0))} hint={`${monthAgg._count} bills`} />}
        {profit && <Stat label="Month net profit (est.)" value={money0(monthProfit - (expensesMonth?._sum.amount ?? 0))} tone={monthProfit - (expensesMonth?._sum.amount ?? 0) >= 0 ? "good" : "bad"} hint={`after ${money0(expensesMonth?._sum.amount)} expenses`} href="/reports" />}
        <Stat label="Products" value={products.length} hint={`${low.length} low · ${out.length} out`} tone={out.length ? "bad" : low.length ? "warn" : "default"} href={can(s.role, "inventory") ? "/inventory" : undefined} />
        {can(s.role, "customers") && <Stat label="Customer dues" value={money0(custDue)} hint={`${dues.length} customers`} tone={custDue > 0 ? "warn" : "good"} href="/customers?dues=yes" />}
        {can(s.role, "suppliers") && <Stat label="Supplier payable" value={money0(suppDue)} tone={suppDue > 0 ? "warn" : "good"} href="/suppliers" />}
        <Stat label="Open job cards" value={openJobs.length} hint={overdueJobs.length ? `${overdueJobs.length} overdue` : "none overdue"} tone={overdueJobs.length ? "bad" : "default"} href="/jobcards" />
      </div>

      <div className="grid gap-5 xl:grid-cols-[1fr_380px]">
        <div className="space-y-5">
          {showMoney && (
            <Section title="Daily sales – last 30 days" actions={can(s.role, "reports") ? <Link href="/reports?type=daily" className="link text-xs">Full report</Link> : undefined}>
              <BarChart data={chart} labelEvery={3} />
            </Section>
          )}
          {showMoney && (
            <div className="grid gap-5 lg:grid-cols-2">
              <Section title="Top selling this month" pad={false}>
                <table className="table">
                  <tbody>
                    {top.map(([id, t], i) => (
                      <tr key={id}>
                        <td className="w-6 text-xs text-gray-400">{i + 1}</td>
                        <td className="text-sm"><Link className="hover:underline" href={`/products/${id}`}>{t.name}</Link></td>
                        <td className="text-right text-sm tabular-nums">{qty(t.qty)} sold</td>
                        <td className="text-right text-xs tabular-nums text-gray-500">{money0(t.value)}</td>
                      </tr>
                    ))}
                    {!top.length && <tr><td className="text-sm text-gray-500">No sales yet this month.</td></tr>}
                  </tbody>
                </table>
              </Section>
              <Section title="Recent bills" pad={false} actions={<Link href="/sales" className="link text-xs">All</Link>}>
                <table className="table">
                  <tbody>
                    {recent.map((r) => (
                      <tr key={r.id}>
                        <td><Link className="link font-mono text-xs" href={`/sales/${r.id}`}>{r.invoiceNo}</Link><div className="text-[11px] text-gray-500">{fmtDateTime(r.date)}</div></td>
                        <td className="text-xs">{r.customerName ?? "Walk-in"}</td>
                        <td className="text-right text-sm tabular-nums">{money(r.total)}</td>
                        <td><Badge status={r.status} /></td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </Section>
            </div>
          )}
        </div>

        <div className="space-y-5">
          <Section title="Alerts">
            <ul className="space-y-3 text-sm">
              {out.length > 0 && <Alert tone="bad" href="/products?stock=out" text={`${out.length} products out of stock`} sub={out.slice(0, 3).map((p) => p.name).join(", ")} />}
              {low.length > 0 && <Alert tone="warn" href="/inventory" text={`${low.length} products running low`} sub={low.slice(0, 3).map((p) => `${p.name} (${p.stock})`).join(", ")} />}
              {overdueJobs.length > 0 && <Alert tone="bad" href="/jobcards" text={`${overdueJobs.length} job cards past promised time`} sub={overdueJobs.slice(0, 3).map((j) => j.number).join(", ")} />}
              {dues.length > 0 && <Alert tone="warn" href="/customers?dues=yes" text={`${money0(custDue)} to collect from ${dues.length} customers`} sub={dues.slice(0, 3).map((d) => `${d.name} ${money0(d.due)}`).join(", ")} />}
              {suppDue > 0 && <Alert tone="warn" href="/suppliers" text={`${money0(suppDue)} payable to suppliers`} />}
              {warrantiesSoon.length > 0 && <Alert tone="info" href="/reports?type=warranty" text={`${warrantiesSoon.length} warranties expire in 30 days`} sub={warrantiesSoon.slice(0, 2).map((w) => `${w.name} – ${w.sale.customerName ?? ""}`).join(", ")} />}
              {!out.length && !low.length && !overdueJobs.length && !dues.length && <li className="text-gray-500">All clear. Nothing needs attention.</li>}
            </ul>
          </Section>
          {openJobs.length > 0 && (
            <Section title="Workshop" pad={false} actions={<Link href="/jobcards" className="link text-xs">Board</Link>}>
              <table className="table">
                <tbody>
                  {openJobs.slice(0, 6).map((j) => (
                    <tr key={j.id}>
                      <td><Link className="link font-mono text-xs" href={`/jobcards/${j.id}`}>{j.number}</Link></td>
                      <td className="max-w-40 truncate text-xs">{j.complaint}</td>
                      <td><span className="text-xs">{label(j.status)}</span></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </Section>
          )}
        </div>
      </div>
    </>
  );
}

function greeting() {
  const h = Number(new Intl.DateTimeFormat("en-IN", { hour: "numeric", hour12: false, timeZone: "Asia/Kolkata" }).format(new Date()));
  return h < 12 ? "morning" : h < 17 ? "afternoon" : "evening";
}

function Alert({ tone, text, sub, href }: { tone: "bad" | "warn" | "info"; text: string; sub?: string; href: string }) {
  const icon = { bad: "⛔", warn: "⚠️", info: "ℹ️" }[tone];
  return (
    <li>
      <Link href={href} className="flex gap-2 rounded-lg p-1 hover:bg-gray-50">
        <span aria-hidden>{icon}</span>
        <span className="min-w-0">
          <span className="block font-medium">{text}</span>
          {sub && <span className="block truncate text-xs text-gray-500">{sub}</span>}
        </span>
      </Link>
    </li>
  );
}
