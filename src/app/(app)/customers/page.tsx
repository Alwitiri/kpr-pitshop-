import Link from "next/link";
import type { Prisma } from "@prisma/client";
import { db, like } from "@/lib/db";
import { requirePage } from "@/lib/auth";
import { can } from "@/lib/roles";
import { SEGMENTS, SEGMENT_ORDER, segmentOf, type Segment } from "@/lib/crm";
import { customerDues } from "@/lib/queries";
import { fmtDate, money } from "@/lib/format";
import { Empty, FilterBar, PageHeader, Pager, Stat, TableWrap, qs } from "@/components/ui";
import { ExportCsv } from "@/components/forms";
import { Icon } from "@/components/icons";

export const metadata = { title: "Customers" };
const PER = 50;

export default async function CustomersPage({ searchParams }: { searchParams: Promise<Record<string, string | undefined>> }) {
  const session = await requirePage("customers");
  const sp = await searchParams;
  const page = Math.max(1, Number(sp.page) || 1);
  const where: Prisma.CustomerWhereInput = {};
  const and: Prisma.CustomerWhereInput[] = [];
  if (sp.q) and.push({ OR: [{ name: like(sp.q) }, { phone: { contains: sp.q.replace(/\s/g, "") } }, { vehicles: { some: { regNo: like(sp.q) } } }] });
  if (sp.make) and.push({ vehicles: { some: { make: like(sp.make) } } });
  if (sp.model) and.push({ vehicles: { some: { model: like(sp.model) } } });
  if (sp.vtype) and.push({ vehicles: { some: { type: sp.vtype } } });
  if (sp.tag) and.push({ tags: like(sp.tag) });
  if (sp.optin === "yes") and.push({ whatsappOptIn: true });
  if (sp.optin === "no") and.push({ whatsappOptIn: false });
  if (and.length) where.AND = and;

  const [customers, dues, totalCount, optedIn] = await Promise.all([
    db.customer.findMany({ where, include: { vehicles: true }, orderBy: { name: "asc" } }),
    customerDues(),
    db.customer.count(),
    db.customer.count({ where: { whatsappOptIn: true } }),
  ]);
  const dueMap = new Map(dues.map((d) => [d.id, d.due]));

  const stats = await db.sale.groupBy({
    by: ["customerId"],
    where: { customerId: { in: customers.map((c) => c.id) }, status: { not: "CANCELLED" } },
    _sum: { total: true, returnedAmount: true },
    _count: true,
    _max: { date: true },
    _min: { date: true },
  });
  const statMap = new Map(stats.map((s) => [s.customerId, s]));

  let rows = customers.map((c) => {
    const st = statMap.get(c.id);
    const spent = (st?._sum.total ?? 0) - (st?._sum.returnedAmount ?? 0);
    const visits = st?._count ?? 0;
    const lastVisit = st?._max.date ?? null;
    return { ...c, due: dueMap.get(c.id) ?? 0, spent, visits, lastVisit, segment: segmentOf({ visits, spent, first: st?._min.date ?? null, last: lastVisit }) };
  });
  if (sp.segment && sp.segment in SEGMENTS) rows = rows.filter((r) => r.segment === (sp.segment as Segment));
  if (sp.dues === "yes") rows = rows.filter((r) => r.due > 0.5);
  if (sp.inactive) {
    const cutoff = Date.now() - Number(sp.inactive) * 864e5;
    rows = rows.filter((r) => !r.lastVisit || r.lastVisit.getTime() < cutoff);
  }
  if (sp.sort === "spent") rows.sort((a, b) => b.spent - a.spent);
  if (sp.sort === "recent") rows.sort((a, b) => (b.lastVisit?.getTime() ?? 0) - (a.lastVisit?.getTime() ?? 0));
  const pageRows = rows.slice((page - 1) * PER, page * PER);

  return (
    <>
      <PageHeader
        title="Customers"
        subtitle="CRM – customers, vehicles and purchase history"
        actions={
          <>
            {can(session.role, "reports") && <Link href="/customers/insights" className="btn-outline">Insights</Link>}
            {can(session.role, "importData") && <Link href="/customers/import" className="btn-outline">Import</Link>}
            <ExportCsv
              filename="customers.csv"
              rows={[["Name", "Phone", "Vehicles", "Tags", "Segment", "WhatsApp opt-in", "Opt-in date", "Visits", "Total spent", "Last visit", "Due"], ...rows.map((r) => [r.name, r.phone, r.vehicles.map((v) => `${v.make} ${v.model ?? ""} ${v.regNo ?? ""}`).join("; "), r.tags, SEGMENTS[r.segment].label, r.whatsappOptIn ? "Yes" : "No", fmtDate(r.optInAt), r.visits, r.spent, fmtDate(r.lastVisit), r.due])]}
            />
            <Link href="/customers/new" className="btn-primary">+ New customer</Link>
          </>
        }
      />
      <div className="mb-5 grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Stat label="Total customers" value={totalCount} />
        <Stat label="WhatsApp opted-in" value={optedIn} hint={`${totalCount ? Math.round((optedIn / totalCount) * 100) : 0}% – ready for broadcasts`} tone="good" href="/customers?optin=yes" />
        <Stat label="Customers with dues" value={dues.length} tone={dues.length ? "warn" : "good"} href="/customers?dues=yes" />
        <Stat label="Total receivable" value={money(dues.reduce((a, d) => a + d.due, 0))} tone="warn" />
      </div>
      <FilterBar>
        <label className="min-w-48 flex-1"><span className="label">Search</span><input name="q" defaultValue={sp.q} className="input" placeholder="Name, mobile or vehicle no." /></label>
        <label><span className="label">Vehicle</span><select name="vtype" defaultValue={sp.vtype ?? ""} className="input"><option value="">Any</option><option value="BIKE">Bike owners</option><option value="CAR">Car owners</option></select></label>
        <label className="w-36"><span className="label">Make</span><input name="make" defaultValue={sp.make} className="input" placeholder="Royal Enfield" /></label>
        <label className="w-32"><span className="label">Model</span><input name="model" defaultValue={sp.model} className="input" placeholder="Classic" /></label>
        <label className="w-28"><span className="label">Tag</span><input name="tag" defaultValue={sp.tag} className="input" /></label>
        <label><span className="label">WhatsApp</span><select name="optin" defaultValue={sp.optin ?? ""} className="input"><option value="">Any</option><option value="yes">Opted in</option><option value="no">Not opted in</option></select></label>
        <label><span className="label">Dues</span><select name="dues" defaultValue={sp.dues ?? ""} className="input"><option value="">Any</option><option value="yes">Has dues</option></select></label>
        <label><span className="label">Not visited</span><select name="inactive" defaultValue={sp.inactive ?? ""} className="input"><option value="">—</option><option value="30">30+ days</option><option value="60">60+ days</option><option value="90">90+ days</option></select></label>
        <label><span className="label">Segment</span><select name="segment" defaultValue={sp.segment ?? ""} className="input"><option value="">Any</option>{SEGMENT_ORDER.map((k) => <option key={k} value={k}>{SEGMENTS[k].label}</option>)}</select></label>
        <label><span className="label">Sort</span><select name="sort" defaultValue={sp.sort ?? ""} className="input"><option value="">Name</option><option value="spent">Top spenders</option><option value="recent">Recent visit</option></select></label>
      </FilterBar>
      <div className="card">
        <TableWrap>
          <table className="table">
            <thead><tr><th>Customer</th><th>Vehicles</th><th>Tags</th><th>Segment</th><th className="text-right">Visits</th><th className="text-right">Spent</th><th>Last visit</th><th className="text-right">Due</th></tr></thead>
            <tbody>
              {pageRows.map((c) => (
                <tr key={c.id}>
                  <td>
                    <Link className="link" href={`/customers/${c.id}`}>{c.name}</Link>
                    <div className="text-xs text-gray-500">{c.phone}{c.whatsappOptIn && <span className="ml-1.5 inline-flex items-center gap-0.5 font-medium text-emerald-700" title="Agreed to WhatsApp messages"><Icon name="chat" className="h-3 w-3" />WA</span>}</div>
                  </td>
                  <td className="text-xs">{c.vehicles.map((v) => <div key={v.id}>{v.make} {v.model} {v.regNo && <span className="text-gray-500">· {v.regNo}</span>}</div>)}</td>
                  <td className="text-xs text-gray-600">{c.tags}</td>
                  <td><span className={`badge ${SEGMENTS[c.segment].cls}`}>{SEGMENTS[c.segment].label}</span></td>
                  <td className="text-right tabular-nums">{c.visits}</td>
                  <td className="text-right tabular-nums">{money(c.spent)}</td>
                  <td className="text-xs">{fmtDate(c.lastVisit)}</td>
                  <td className={`text-right tabular-nums ${c.due > 0.5 ? "font-semibold text-amber-700" : "text-gray-400"}`}>{c.due > 0.5 ? money(c.due) : "—"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </TableWrap>
        {!pageRows.length && <Empty>No customers found.</Empty>}
        <Pager page={page} pages={Math.ceil(rows.length / PER)} base={`/customers${qs(sp)}`} />
      </div>
    </>
  );
}
