import { db } from "@/lib/db";
import { requirePage } from "@/lib/auth";
import { cashSummary } from "@/lib/cash";
import { fmtDate, fmtDateTime, money, ymd } from "@/lib/format";
import { PageHeader, Section, Stat, TableWrap } from "@/components/ui";
import { ActionForm, Submit } from "@/components/forms";
import { closeDay } from "@/actions/expenses";

export const metadata = { title: "Cash book" };

export default async function CashbookPage({ searchParams }: { searchParams: Promise<{ date?: string }> }) {
  await requirePage("expenses");
  const date = (await searchParams).date || ymd();
  const [sum, closes, existing] = await Promise.all([
    cashSummary(date),
    db.dayClose.findMany({ orderBy: { date: "desc" }, take: 30 }),
    db.dayClose.findUnique({ where: { date } }),
  ]);
  const methods = Object.entries(sum.byMethod);

  return (
    <>
      <PageHeader title="Cash book & day closing" subtitle={fmtDate(`${date}T12:00:00+05:30`)} back="/expenses" />
      <form className="mb-4 flex items-end gap-2 no-print">
        <label><span className="label">Date</span><input type="date" name="date" defaultValue={date} className="input" /></label>
        <button className="btn-dark">Show</button>
      </form>
      <div className="mb-5 grid grid-cols-2 gap-3 lg:grid-cols-5">
        <Stat label="Opening cash" value={money(sum.opening)} hint={sum.openingFrom ? `Counted on ${sum.openingFrom}` : "No previous closing"} />
        <Stat label="Cash in" value={money(sum.cashIn)} tone="good" />
        <Stat label="Cash out" value={money(sum.cashOut)} tone="bad" hint="refunds + expenses + supplier" />
        <Stat label="Expected in drawer" value={money(sum.expected)} />
        <Stat label="All receipts today" value={money(sum.receipts)} hint="cash + UPI + card + bank" />
      </div>
      <div className="grid gap-5 lg:grid-cols-2">
        <Section title="By payment method" pad={false}>
          <table className="table">
            <thead><tr><th>Method</th><th className="text-right">Received</th><th className="text-right">Paid out</th><th className="text-right">Net</th></tr></thead>
            <tbody>
              {methods.map(([m, v]) => (
                <tr key={m}><td>{m}</td><td className="text-right tabular-nums">{money(v.in)}</td><td className="text-right tabular-nums">{money(v.out)}</td><td className="text-right font-semibold tabular-nums">{money(v.in - v.out)}</td></tr>
              ))}
              {!methods.length && <tr><td colSpan={4} className="text-center text-sm text-gray-500">No money movement on this day.</td></tr>}
            </tbody>
          </table>
          <div className="grid grid-cols-3 gap-2 border-t p-4 text-xs text-gray-600">
            <div>Refunds: <b>{money(sum.refunds)}</b></div>
            <div>Expenses: <b>{money(sum.expenses)}</b></div>
            <div>Supplier paid: <b>{money(sum.supplierPaid)}</b></div>
          </div>
        </Section>
        <Section title="Close the day">
          {existing && (
            <div className="mb-3 rounded-lg bg-gray-50 p-3 text-sm">
              Already closed: counted {money(existing.counted)}, difference{" "}
              <b className={existing.difference === 0 ? "text-emerald-700" : "text-red-600"}>{money(existing.difference)}</b>. Saving again will update it.
            </div>
          )}
          <ActionForm action={closeDay} className="space-y-3">
            <input type="hidden" name="date" value={date} />
            <label className="block"><span className="label">Cash counted in drawer ₹</span><input name="counted" type="number" step="0.01" min="0" className="input text-lg" defaultValue={existing?.counted ?? sum.expected} required /></label>
            <label className="block"><span className="label">Note</span><input name="note" className="input" defaultValue={existing?.note ?? ""} placeholder="e.g. ₹2000 taken home by owner" /></label>
            <Submit>Save day closing</Submit>
          </ActionForm>
        </Section>
        <Section title="Previous closings" pad={false} className="lg:col-span-2">
          <TableWrap>
            <table className="table">
              <thead><tr><th>Date</th><th className="text-right">Opening</th><th className="text-right">Cash in</th><th className="text-right">Cash out</th><th className="text-right">Expected</th><th className="text-right">Counted</th><th className="text-right">Difference</th><th>Note</th><th>Closed at</th></tr></thead>
              <tbody>
                {closes.map((c) => (
                  <tr key={c.id}>
                    <td className="text-sm">{c.date}</td>
                    <td className="text-right tabular-nums">{money(c.openingCash)}</td>
                    <td className="text-right tabular-nums">{money(c.cashIn)}</td>
                    <td className="text-right tabular-nums">{money(c.cashOut)}</td>
                    <td className="text-right tabular-nums">{money(c.expected)}</td>
                    <td className="text-right tabular-nums">{money(c.counted)}</td>
                    <td className={`text-right font-semibold tabular-nums ${c.difference === 0 ? "text-emerald-700" : "text-red-600"}`}>{money(c.difference)}</td>
                    <td className="text-xs">{c.note}</td>
                    <td className="text-xs">{fmtDateTime(c.createdAt)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </TableWrap>
        </Section>
      </div>
    </>
  );
}
