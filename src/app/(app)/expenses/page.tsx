import Link from "next/link";
import type { Prisma } from "@prisma/client";
import { db } from "@/lib/db";
import { requirePage } from "@/lib/auth";
import { dayRange, fmtDate, money, monthStart, ymd } from "@/lib/format";
import { EXPENSE_CATEGORIES, label } from "@/lib/calc";
import { Empty, FilterBar, PageHeader, Section, Stat, TableWrap } from "@/components/ui";
import { ActionForm, ExportCsv, Submit } from "@/components/forms";
import { addExpense, deleteExpense } from "@/actions/expenses";

export const metadata = { title: "Expenses" };

export default async function ExpensesPage({ searchParams }: { searchParams: Promise<Record<string, string | undefined>> }) {
  const s = await requirePage("expenses");
  const sp = await searchParams;
  const from = sp.from || monthStart();
  const to = sp.to || ymd();
  const where: Prisma.ExpenseWhereInput = { date: dayRange(from, to) };
  if (sp.category) where.category = sp.category;
  const rows = await db.expense.findMany({ where, include: { user: { select: { name: true } } }, orderBy: { date: "desc" } });
  const total = rows.reduce((a, r) => a + r.amount, 0);
  const byCat = new Map<string, number>();
  for (const r of rows) byCat.set(r.category, (byCat.get(r.category) ?? 0) + r.amount);
  const canDelete = s.role === "OWNER" || s.role === "MANAGER";

  return (
    <>
      <PageHeader title="Expenses" subtitle="Rent, electricity, salaries and other shop costs" actions={<Link href="/expenses/cashbook" className="btn-primary">Cash book & day closing</Link>} />
      <div className="grid gap-5 xl:grid-cols-[380px_1fr]">
        <div className="space-y-5">
          <Section title="Add expense">
            <ActionForm action={addExpense} resetOnSuccess className="space-y-3">
              <div className="grid grid-cols-2 gap-3">
                <label><span className="label">Date</span><input name="date" type="date" className="input" defaultValue={ymd()} /></label>
                <label><span className="label">Amount ₹</span><input name="amount" type="number" step="0.01" min="0.01" className="input" required /></label>
                <label>
                  <span className="label">Category</span>
                  <select name="category" className="input">{EXPENSE_CATEGORIES.map((c) => <option key={c} value={c}>{label(c)}</option>)}</select>
                </label>
                <label>
                  <span className="label">Paid by</span>
                  <select name="method" className="input">{["CASH", "UPI", "BANK", "CARD"].map((m) => <option key={m}>{m}</option>)}</select>
                </label>
              </div>
              <label className="block"><span className="label">Paid to</span><input name="paidTo" className="input" /></label>
              <label className="block"><span className="label">Note</span><input name="note" className="input" /></label>
              <Submit>Save expense</Submit>
            </ActionForm>
          </Section>
          <Section title="By category">
            <ul className="space-y-1.5 text-sm">
              {[...byCat.entries()].sort((a, b) => b[1] - a[1]).map(([c, v]) => (
                <li key={c}>
                  <div className="flex justify-between"><span>{label(c)}</span><span className="tabular-nums">{money(v)}</span></div>
                  <div className="mt-0.5 h-1.5 rounded bg-gray-100"><div className="h-1.5 rounded bg-brand-500" style={{ width: `${(v / (total || 1)) * 100}%` }} /></div>
                </li>
              ))}
            </ul>
          </Section>
        </div>
        <div>
          <div className="mb-4 grid grid-cols-2 gap-3">
            <Stat label="Total expenses" value={money(total)} hint={`${fmtDate(from)} – ${fmtDate(to)}`} />
            <Stat label="Entries" value={rows.length} />
          </div>
          <FilterBar>
            <label><span className="label">From</span><input type="date" name="from" defaultValue={from} className="input" /></label>
            <label><span className="label">To</span><input type="date" name="to" defaultValue={to} className="input" /></label>
            <label>
              <span className="label">Category</span>
              <select name="category" defaultValue={sp.category ?? ""} className="input"><option value="">All</option>{EXPENSE_CATEGORIES.map((c) => <option key={c} value={c}>{label(c)}</option>)}</select>
            </label>
            <ExportCsv filename="expenses.csv" label="Export" rows={[["Date", "Category", "Amount", "Method", "Paid to", "Note", "By"], ...rows.map((r) => [fmtDate(r.date), label(r.category), r.amount, r.method, r.paidTo, r.note, r.user?.name])]} />
          </FilterBar>
          <div className="card">
            <TableWrap>
              <table className="table">
                <thead><tr><th>Date</th><th>Category</th><th>Paid to / note</th><th>Method</th><th>By</th><th className="text-right">Amount</th><th /></tr></thead>
                <tbody>
                  {rows.map((r) => (
                    <tr key={r.id}>
                      <td className="text-sm">{fmtDate(r.date)}</td>
                      <td className="text-sm">{label(r.category)}</td>
                      <td className="text-xs text-gray-600">{[r.paidTo, r.note].filter(Boolean).join(" · ")}</td>
                      <td className="text-xs">{r.method}</td>
                      <td className="text-xs">{r.user?.name}</td>
                      <td className="text-right tabular-nums">{money(r.amount)}</td>
                      <td>{canDelete && <form action={deleteExpense}><input type="hidden" name="id" value={r.id} /><Submit className="text-xs text-gray-400 hover:text-red-600" confirm="Delete this expense?">Delete</Submit></form>}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </TableWrap>
            {!rows.length && <Empty>No expenses in this period.</Empty>}
          </div>
        </div>
      </div>
    </>
  );
}
