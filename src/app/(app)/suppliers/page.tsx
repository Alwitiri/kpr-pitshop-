import Link from "next/link";
import { requirePage } from "@/lib/auth";
import { supplierBalances } from "@/lib/queries";
import { money } from "@/lib/format";
import { Empty, PageHeader, Stat, TableWrap } from "@/components/ui";

export const metadata = { title: "Suppliers" };

export default async function SuppliersPage({ searchParams }: { searchParams: Promise<{ q?: string }> }) {
  await requirePage("suppliers");
  const q = (await searchParams).q?.toLowerCase() ?? "";
  const all = await supplierBalances();
  const rows = all.filter((s) => !q || `${s.name} ${s.phone ?? ""}`.toLowerCase().includes(q)).sort((a, b) => b.balance - a.balance);
  const totalDue = all.reduce((a, s) => a + Math.max(0, s.balance), 0);
  return (
    <>
      <PageHeader title="Suppliers" subtitle={`${all.length} suppliers`} actions={<Link href="/suppliers/new" className="btn-primary">+ New supplier</Link>} />
      <div className="mb-5 grid grid-cols-2 gap-3 lg:grid-cols-3">
        <Stat label="Total payable to suppliers" value={money(totalDue)} tone={totalDue > 0 ? "warn" : "good"} />
        <Stat label="Suppliers with dues" value={all.filter((s) => s.balance > 0.5).length} />
      </div>
      <form className="mb-4 no-print"><input name="q" defaultValue={q} className="input max-w-sm" placeholder="Search suppliers…" /></form>
      <div className="card">
        <TableWrap>
          <table className="table">
            <thead><tr><th>Supplier</th><th>Phone</th><th className="text-right">Total purchased</th><th className="text-right">Paid</th><th className="text-right">Returns</th><th className="text-right">Balance due</th></tr></thead>
            <tbody>
              {rows.map((s) => (
                <tr key={s.id}>
                  <td><Link className="link" href={`/suppliers/${s.id}`}>{s.name}</Link>{!s.active && <span className="ml-2 text-xs text-gray-400">(inactive)</span>}</td>
                  <td className="text-sm">{s.phone}</td>
                  <td className="text-right tabular-nums">{money(s.purchased)}</td>
                  <td className="text-right tabular-nums">{money(s.paid)}</td>
                  <td className="text-right tabular-nums">{money(s.returned)}</td>
                  <td className={`text-right font-semibold tabular-nums ${s.balance > 0.5 ? "text-amber-700" : "text-gray-500"}`}>{money(s.balance)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </TableWrap>
        {!rows.length && <Empty>No suppliers yet.</Empty>}
      </div>
    </>
  );
}
