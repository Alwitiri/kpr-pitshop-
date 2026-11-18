import Link from "next/link";
import type { Prisma } from "@prisma/client";
import { db } from "@/lib/db";
import { requirePage } from "@/lib/auth";
import { dayRange, fmtDateTime, qty } from "@/lib/format";
import { label } from "@/lib/calc";
import { Empty, FilterBar, PageHeader, Pager, TableWrap, qs } from "@/components/ui";

export const metadata = { title: "Stock ledger" };
const TYPES = ["OPENING", "PURCHASE", "SALE", "SALE_RETURN", "SALE_CANCEL", "PURCHASE_RETURN", "ADJUSTMENT", "DAMAGE", "STOCK_CHECK", "JOB_USE"];
const PER = 100;

const REF_LINK: Record<string, string> = { Sale: "/sales/", Purchase: "/purchases/", JobCard: "/jobcards/" };

export default async function MovementsPage({ searchParams }: { searchParams: Promise<Record<string, string | undefined>> }) {
  await requirePage("inventory");
  const sp = await searchParams;
  const page = Math.max(1, Number(sp.page) || 1);
  const where: Prisma.StockMovementWhereInput = {};
  if (sp.product) where.productId = Number(sp.product);
  if (sp.type) where.type = sp.type;
  if (sp.from || sp.to) where.createdAt = dayRange(sp.from || "2000-01-01", sp.to || "2999-12-31");
  const [total, rows, product] = await Promise.all([
    db.stockMovement.count({ where }),
    db.stockMovement.findMany({
      where,
      include: { product: { select: { id: true, name: true, sku: true } }, user: { select: { name: true } } },
      orderBy: { createdAt: "desc" },
      skip: (page - 1) * PER,
      take: PER,
    }),
    sp.product ? db.product.findUnique({ where: { id: Number(sp.product) }, select: { name: true } }) : null,
  ]);
  return (
    <>
      <PageHeader title="Stock ledger" subtitle={product ? `Showing: ${product.name}` : "Every stock movement, newest first"} back="/inventory" />
      <FilterBar>
        {sp.product && <input type="hidden" name="product" value={sp.product} />}
        <label>
          <span className="label">Type</span>
          <select name="type" defaultValue={sp.type ?? ""} className="input">
            <option value="">All</option>
            {TYPES.map((t) => <option key={t} value={t}>{label(t)}</option>)}
          </select>
        </label>
        <label><span className="label">From</span><input type="date" name="from" defaultValue={sp.from} className="input" /></label>
        <label><span className="label">To</span><input type="date" name="to" defaultValue={sp.to} className="input" /></label>
        {sp.product && <Link className="btn-ghost" href="/inventory/movements">Show all products</Link>}
      </FilterBar>
      <div className="card">
        <TableWrap>
          <table className="table">
            <thead><tr><th>When</th><th>Product</th><th>Type</th><th className="text-right">Change</th><th className="text-right">Balance</th><th>Reference</th><th>Note</th><th>By</th></tr></thead>
            <tbody>
              {rows.map((m) => (
                <tr key={m.id}>
                  <td className="text-xs whitespace-nowrap">{fmtDateTime(m.createdAt)}</td>
                  <td><Link className="link" href={`/products/${m.product.id}`}>{m.product.name}</Link></td>
                  <td className="text-xs">{label(m.type)}</td>
                  <td className={`text-right font-semibold tabular-nums ${m.qty < 0 ? "text-red-600" : "text-emerald-600"}`}>{m.qty > 0 ? "+" : ""}{qty(m.qty)}</td>
                  <td className="text-right tabular-nums">{qty(m.balanceAfter)}</td>
                  <td className="text-xs">
                    {m.refType && m.refId && REF_LINK[m.refType] ? <Link className="link" href={`${REF_LINK[m.refType]}${m.refId}`}>{m.refType} #{m.refId}</Link> : m.refType ?? ""}
                  </td>
                  <td className="max-w-56 truncate text-xs text-gray-600">{m.note}</td>
                  <td className="text-xs">{m.user?.name}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </TableWrap>
        {!rows.length && <Empty>No stock movements found.</Empty>}
        <Pager page={page} pages={Math.ceil(total / PER)} base={`/inventory/movements${qs(sp)}`} />
      </div>
    </>
  );
}
