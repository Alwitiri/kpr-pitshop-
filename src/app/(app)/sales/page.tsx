import Link from "next/link";
import type { Prisma } from "@prisma/client";
import { db, like } from "@/lib/db";
import { requirePage } from "@/lib/auth";
import { dayRange, fmtDateTime, money, ymd } from "@/lib/format";
import { Badge, Empty, FilterBar, PageHeader, Pager, Stat, TableWrap, qs } from "@/components/ui";
import { ExportCsv } from "@/components/forms";

export const metadata = { title: "Sales & invoices" };
const PER = 50;

export default async function SalesPage({ searchParams }: { searchParams: Promise<Record<string, string | undefined>> }) {
  await requirePage("sales");
  const sp = await searchParams;
  const page = Math.max(1, Number(sp.page) || 1);
  const from = sp.from ?? (sp.q || sp.status ? "" : ymd(new Date(Date.now() - 6 * 864e5)));
  const to = sp.to ?? "";
  const where: Prisma.SaleWhereInput = {};
  if (from || to) where.date = dayRange(from || "2000-01-01", to || "2999-12-31");
  if (sp.status) where.status = sp.status === "due" ? { in: ["PARTIAL", "UNPAID"] } : sp.status;
  if (sp.user) where.userId = Number(sp.user);
  if (sp.q) where.OR = [{ invoiceNo: like(sp.q) }, { customerName: like(sp.q) }, { customerPhone: { contains: sp.q } }];

  const [count, rows, agg, users] = await Promise.all([
    db.sale.count({ where }),
    db.sale.findMany({ where, include: { user: { select: { name: true } }, payments: { select: { method: true } }, _count: { select: { items: true } } }, orderBy: { date: "desc" }, skip: (page - 1) * PER, take: PER }),
    db.sale.aggregate({ where: { ...where, status: where.status ?? { not: "CANCELLED" } }, _sum: { total: true, paidAmount: true, returnedAmount: true }, _count: true }),
    db.user.findMany({ select: { id: true, name: true }, orderBy: { name: "asc" } }),
  ]);
  const net = (agg._sum.total ?? 0) - (agg._sum.returnedAmount ?? 0);

  return (
    <>
      <PageHeader
        title="Sales & invoices"
        actions={
          <>
            <ExportCsv filename="sales.csv" rows={[["Invoice", "Date", "Customer", "Phone", "Total", "Paid", "Returned", "Status"], ...rows.map((r) => [r.invoiceNo, fmtDateTime(r.date), r.customerName, r.customerPhone, r.total, r.paidAmount, r.returnedAmount, r.status])]} />
            <Link href="/sales/returns" className="btn-outline">Returns</Link>
            <Link href="/pos" className="btn-primary">+ New bill</Link>
          </>
        }
      />
      <div className="mb-5 grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Stat label="Bills" value={agg._count} />
        <Stat label="Net sales" value={money(net)} />
        <Stat label="Collected" value={money(agg._sum.paidAmount)} />
        <Stat label="Outstanding" value={money(Math.max(0, net - (agg._sum.paidAmount ?? 0)))} tone="warn" />
      </div>
      <FilterBar>
        <label className="min-w-48 flex-1"><span className="label">Search</span><input name="q" defaultValue={sp.q} className="input" placeholder="Invoice no., customer, phone" /></label>
        <label><span className="label">From</span><input type="date" name="from" defaultValue={from} className="input" /></label>
        <label><span className="label">To</span><input type="date" name="to" defaultValue={to} className="input" /></label>
        <label>
          <span className="label">Status</span>
          <select name="status" defaultValue={sp.status ?? ""} className="input">
            <option value="">All</option><option value="PAID">Paid</option><option value="due">Credit / due</option><option value="CANCELLED">Cancelled</option>
          </select>
        </label>
        <label>
          <span className="label">Billed by</span>
          <select name="user" defaultValue={sp.user ?? ""} className="input"><option value="">Anyone</option>{users.map((u) => <option key={u.id} value={u.id}>{u.name}</option>)}</select>
        </label>
      </FilterBar>
      <div className="card">
        <TableWrap>
          <table className="table">
            <thead><tr><th>Invoice</th><th>Date</th><th>Customer</th><th className="text-right">Items</th><th>Paid by</th><th>Billed by</th><th className="text-right">Total</th><th className="text-right">Due</th><th>Status</th></tr></thead>
            <tbody>
              {rows.map((r) => {
                const due = r.status === "CANCELLED" ? 0 : r.total - r.returnedAmount - r.paidAmount;
                return (
                  <tr key={r.id}>
                    <td><Link className="link font-mono text-xs" href={`/sales/${r.id}`}>{r.invoiceNo}</Link></td>
                    <td className="text-xs whitespace-nowrap">{fmtDateTime(r.date)}</td>
                    <td className="text-sm">{r.customerId ? <Link className="hover:underline" href={`/customers/${r.customerId}`}>{r.customerName}</Link> : r.customerName ?? <span className="text-gray-400">Walk-in</span>}</td>
                    <td className="text-right">{r._count.items}</td>
                    <td className="text-xs">{[...new Set(r.payments.map((p) => p.method))].join(" + ") || "Credit"}</td>
                    <td className="text-xs">{r.user?.name}</td>
                    <td className="text-right font-medium tabular-nums">{money(r.total)}</td>
                    <td className="text-right tabular-nums">{due > 0.5 ? money(due) : "—"}</td>
                    <td><Badge status={r.status} /></td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </TableWrap>
        {!rows.length && <Empty>No bills in this period.</Empty>}
        <Pager page={page} pages={Math.ceil(count / PER)} base={`/sales${qs({ ...sp, from, to })}`} />
      </div>
    </>
  );
}
