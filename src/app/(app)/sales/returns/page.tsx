import Link from "next/link";
import { db } from "@/lib/db";
import { requirePage } from "@/lib/auth";
import { fmtDateTime, money } from "@/lib/format";
import { label } from "@/lib/calc";
import { Empty, PageHeader, TableWrap } from "@/components/ui";

export const metadata = { title: "Sales returns" };

export default async function ReturnsPage() {
  await requirePage("sales");
  const rows = await db.saleReturn.findMany({ include: { sale: { select: { id: true, invoiceNo: true, customerName: true } } }, orderBy: { date: "desc" }, take: 200 });
  return (
    <>
      <PageHeader title="Sales returns & exchanges" subtitle="To create a return, open the original bill and use “Return items”. For an exchange, return the item, then make a new bill." back="/sales" />
      <div className="card">
        <TableWrap>
          <table className="table">
            <thead><tr><th>Return no.</th><th>Date</th><th>Original bill</th><th>Customer</th><th>Items</th><th>Refund</th><th className="text-right">Amount</th><th>Reason</th></tr></thead>
            <tbody>
              {rows.map((r) => {
                const items = JSON.parse(r.items) as { name: string; qty: number }[];
                return (
                  <tr key={r.id}>
                    <td className="font-mono text-xs">{r.number}</td>
                    <td className="text-xs">{fmtDateTime(r.date)}</td>
                    <td><Link className="link font-mono text-xs" href={`/sales/${r.sale.id}`}>{r.sale.invoiceNo}</Link></td>
                    <td className="text-sm">{r.sale.customerName}</td>
                    <td className="text-xs">{items.map((i) => `${i.name} × ${i.qty}`).join(", ")}</td>
                    <td className="text-xs">{label(r.refundMethod)}</td>
                    <td className="text-right tabular-nums">{money(r.total)}</td>
                    <td className="text-xs text-gray-600">{r.reason}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </TableWrap>
        {!rows.length && <Empty>No returns yet.</Empty>}
      </div>
    </>
  );
}
