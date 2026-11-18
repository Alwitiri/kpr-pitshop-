import Link from "next/link";
import type { Prisma } from "@prisma/client";
import { db } from "@/lib/db";
import { requirePage } from "@/lib/auth";
import { dayRange, fmtDate, money, round2 } from "@/lib/format";
import { Badge, Empty, FilterBar, PageHeader, Pager, Stat, TableWrap, qs } from "@/components/ui";

export const metadata = { title: "Purchases" };
const PER = 50;

export default async function PurchasesPage({ searchParams }: { searchParams: Promise<Record<string, string | undefined>> }) {
  await requirePage("purchases");
  const sp = await searchParams;
  const page = Math.max(1, Number(sp.page) || 1);
  const where: Prisma.PurchaseWhereInput = {};
  if (sp.supplier) where.supplierId = Number(sp.supplier);
  if (sp.from || sp.to) where.date = dayRange(sp.from || "2000-01-01", sp.to || "2999-12-31");
  if (sp.q) where.OR = [{ number: { contains: sp.q } }, { supplierBillNo: { contains: sp.q } }];

  const [all, suppliers] = await Promise.all([
    db.purchase.findMany({ where, include: { supplier: { select: { name: true } }, returns: { select: { total: true } }, _count: { select: { items: true } } }, orderBy: { date: "desc" } }),
    db.supplier.findMany({ orderBy: { name: "asc" }, select: { id: true, name: true } }),
  ]);
  const withDue = all.map((p) => ({ ...p, due: round2(p.total - p.returns.reduce((a, r) => a + r.total, 0) - p.paidAmount) }));
  const filtered = sp.status === "due" ? withDue.filter((p) => p.due > 0.5) : withDue;
  const rows = filtered.slice((page - 1) * PER, page * PER);

  return (
    <>
      <PageHeader title="Purchases" subtitle="Stock bought from suppliers" actions={<Link href="/purchases/new" className="btn-primary">+ New purchase</Link>} />
      <div className="mb-5 grid grid-cols-2 gap-3 lg:grid-cols-3">
        <Stat label="Purchases (filtered)" value={money(filtered.reduce((a, p) => a + p.total, 0))} hint={`${filtered.length} bills`} />
        <Stat label="Unpaid on these bills" value={money(filtered.reduce((a, p) => a + Math.max(0, p.due), 0))} tone="warn" />
      </div>
      <FilterBar>
        <label className="min-w-40"><span className="label">Bill no.</span><input name="q" defaultValue={sp.q} className="input" /></label>
        <label>
          <span className="label">Supplier</span>
          <select name="supplier" defaultValue={sp.supplier ?? ""} className="input">
            <option value="">All</option>
            {suppliers.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
          </select>
        </label>
        <label>
          <span className="label">Status</span>
          <select name="status" defaultValue={sp.status ?? ""} className="input"><option value="">All</option><option value="due">Unpaid / partial</option></select>
        </label>
        <label><span className="label">From</span><input type="date" name="from" defaultValue={sp.from} className="input" /></label>
        <label><span className="label">To</span><input type="date" name="to" defaultValue={sp.to} className="input" /></label>
      </FilterBar>
      <div className="card">
        <TableWrap>
          <table className="table">
            <thead><tr><th>No.</th><th>Date</th><th>Supplier</th><th>Supplier bill</th><th className="text-right">Items</th><th className="text-right">Total</th><th className="text-right">Due</th><th>Status</th></tr></thead>
            <tbody>
              {rows.map((p) => (
                <tr key={p.id}>
                  <td><Link className="link" href={`/purchases/${p.id}`}>{p.number}</Link></td>
                  <td className="text-sm">{fmtDate(p.date)}</td>
                  <td className="text-sm">{p.supplier.name}</td>
                  <td className="text-sm">{p.supplierBillNo}</td>
                  <td className="text-right">{p._count.items}</td>
                  <td className="text-right tabular-nums">{money(p.total)}</td>
                  <td className="text-right tabular-nums">{money(Math.max(0, p.due))}</td>
                  <td><Badge status={p.due <= 0.5 ? "PAID" : p.paidAmount > 0 ? "PARTIAL" : "UNPAID"} /></td>
                </tr>
              ))}
            </tbody>
          </table>
        </TableWrap>
        {!rows.length && <Empty>No purchases found.</Empty>}
        <Pager page={page} pages={Math.ceil(filtered.length / PER)} base={`/purchases${qs(sp)}`} />
      </div>
    </>
  );
}
