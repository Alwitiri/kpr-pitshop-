import Link from "next/link";
import { db } from "@/lib/db";
import { requirePage } from "@/lib/auth";
import { soldItems, groupSum, daysBetween } from "@/lib/reports";
import { customerDues, supplierBalances } from "@/lib/queries";
import { addDays, dayRange, fmtDate, money, monthStart, qty, round2, ymd } from "@/lib/format";
import { label } from "@/lib/calc";
import { PageHeader, Section, Stat, TableWrap } from "@/components/ui";
import { ExportCsv, PrintButton } from "@/components/forms";
import { BarChart } from "@/components/bar-chart";

export const metadata = { title: "Reports" };

const TABS: [string, string][] = [
  ["summary", "Profit & loss"], ["daily", "Daily sales"], ["monthly", "Monthly sales"], ["products", "Product-wise"],
  ["categories", "Category-wise"], ["brands", "Brand-wise"], ["gst", "GST summary"], ["purchases", "Purchases"],
  ["payments", "Payment modes"], ["staff", "Staff performance"], ["customers", "Top customers"], ["dues", "Dues"], ["warranty", "Warranties"],
];

type Row = (string | number | null | undefined)[];

export default async function ReportsPage({ searchParams }: { searchParams: Promise<Record<string, string | undefined>> }) {
  await requirePage("reports");
  const sp = await searchParams;
  const type = sp.type ?? "summary";
  const today = ymd();
  const from = sp.from || (type === "monthly" ? `${today.slice(0, 4)}-01-01` : monthStart());
  const to = sp.to || today;
  const range = dayRange(from, to);
  const presets: [string, string, string][] = [
    ["Today", today, today],
    ["Yesterday", addDays(today, -1), addDays(today, -1)],
    ["Last 7 days", addDays(today, -6), today],
    ["This month", monthStart(), today],
    ["Last month", addDays(monthStart(), -1).slice(0, 8) + "01", addDays(monthStart(), -1)],
    ["This year", `${today.slice(0, 4)}-01-01`, today],
  ];

  let title = "";
  let head: string[] = [];
  let rows: Row[] = [];
  let totals: Row | null = null;
  let chart: { label: string; value: number; tip?: string }[] | null = null;
  let stats: { label: string; value: string; tone?: "good" | "bad" | "warn" }[] = [];

  const needItems = ["summary", "daily", "monthly", "products", "categories", "brands", "staff", "customers"].includes(type);
  const items = needItems ? await soldItems(from, to) : [];
  const sum = (f: (i: (typeof items)[number]) => number) => round2(items.reduce((a, i) => a + f(i), 0));

  if (type === "summary") {
    title = "Profit & loss";
    const [expenses, purchases, bills] = await Promise.all([
      db.expense.groupBy({ by: ["category"], where: { date: range }, _sum: { amount: true } }),
      db.purchase.aggregate({ where: { date: range }, _sum: { total: true, taxTotal: true } }),
      db.sale.aggregate({ where: { date: range, status: { not: "CANCELLED" } }, _count: true, _sum: { discount: true } }),
    ]);
    const revenue = sum((i) => i.revenue);
    const cogs = sum((i) => i.cost);
    const gp = round2(revenue - cogs);
    const exp = round2(expenses.reduce((a, e) => a + (e._sum.amount ?? 0), 0));
    const np = round2(gp - exp);
    stats = [
      { label: "Sales (excl. GST)", value: money(revenue) },
      { label: "Gross profit", value: money(gp), tone: "good" },
      { label: "Expenses", value: money(exp), tone: "warn" },
      { label: "Net profit", value: money(np), tone: np >= 0 ? "good" : "bad" },
    ];
    head = ["", "Amount"];
    rows = [
      ["Sales incl. GST", money(sum((i) => i.gross))],
      ["Less: GST collected", money(sum((i) => i.tax))],
      ["Net sales (excl. GST)", money(revenue)],
      ["Less: cost of goods sold", money(cogs)],
      ["Gross profit", money(gp)],
      ["Gross margin", revenue ? `${((gp / revenue) * 100).toFixed(1)}%` : "—"],
      ...expenses.map((e) => [`Less: ${label(e.category)}`, money(e._sum.amount)] as Row),
      ["Net profit", money(np)],
      ["", ""],
      ["Bills", bills._count],
      ["Average bill", money(bills._count ? sum((i) => i.gross) / bills._count : 0)],
      ["Discounts given", money(bills._sum.discount)],
      ["Purchases made (incl. GST)", money(purchases._sum.total)],
    ];
  }

  if (type === "daily") {
    title = "Daily sales";
    const g = new Map(groupSum(items, (i) => i.day, (i) => ({ gross: i.gross, revenue: i.revenue, tax: i.tax, profit: i.profit })).map((r) => [r.key, r.v]));
    const bills = await db.sale.findMany({ where: { date: range, status: { not: "CANCELLED" } }, select: { date: true } });
    const billCount = new Map<string, number>();
    for (const b of bills) billCount.set(ymd(b.date), (billCount.get(ymd(b.date)) ?? 0) + 1);
    const days = daysBetween(from, to);
    chart = days.map((d) => ({ label: d.slice(8), value: Math.round(g.get(d)?.gross ?? 0), tip: fmtDate(`${d}T12:00:00+05:30`) }));
    head = ["Date", "Bills", "Sales incl. GST", "GST", "Sales excl. GST", "Profit"];
    rows = days.slice().reverse().map((d) => [d, billCount.get(d) ?? 0, money(g.get(d)?.gross), money(g.get(d)?.tax), money(g.get(d)?.revenue), money(g.get(d)?.profit)]);
    totals = ["Total", bills.length, money(sum((i) => i.gross)), money(sum((i) => i.tax)), money(sum((i) => i.revenue)), money(sum((i) => i.profit))];
  }

  if (type === "monthly") {
    title = "Monthly sales";
    const g = groupSum(items, (i) => i.month, (i) => ({ gross: i.gross, revenue: i.revenue, tax: i.tax, profit: i.profit })).sort((a, b) => a.key.localeCompare(b.key));
    const exp = await db.expense.findMany({ where: { date: range }, select: { date: true, amount: true } });
    const em = new Map<string, number>();
    for (const e of exp) em.set(ymd(e.date).slice(0, 7), (em.get(ymd(e.date).slice(0, 7)) ?? 0) + e.amount);
    chart = g.map((r) => ({ label: r.key.slice(2), value: Math.round(r.v.gross), tip: r.key }));
    head = ["Month", "Sales incl. GST", "GST", "Sales excl. GST", "Gross profit", "Expenses", "Net profit"];
    rows = g.map((r) => [r.key, money(r.v.gross), money(r.v.tax), money(r.v.revenue), money(r.v.profit), money(em.get(r.key)), money(r.v.profit - (em.get(r.key) ?? 0))]);
  }

  if (type === "products" || type === "categories" || type === "brands") {
    const key =
      type === "products" ? (i: (typeof items)[number]) => i.productId ? `${i.name}` : "Service / labour"
      : type === "categories" ? (i: (typeof items)[number]) => i.product?.category?.name ?? (i.productId ? "Uncategorised" : "Service / labour")
      : (i: (typeof items)[number]) => i.product?.brand?.name ?? (i.productId ? "No brand" : "Service / labour");
    title = TABS.find((t) => t[0] === type)![1] + " sales";
    const g = groupSum(items, key, (i) => ({ qty: i.netQty, gross: i.gross, revenue: i.revenue, cost: i.cost, profit: i.profit })).sort((a, b) => b.v.gross - a.v.gross);
    head = [type === "products" ? "Product" : type === "categories" ? "Category" : "Brand", "Qty sold", "Sales incl. GST", "Sales excl. GST", "Cost", "Profit", "Margin"];
    rows = g.map((r) => [r.key, qty(r.v.qty), money(r.v.gross), money(r.v.revenue), money(r.v.cost), money(r.v.profit), r.v.revenue ? `${((r.v.profit / r.v.revenue) * 100).toFixed(1)}%` : "—"]);
    totals = ["Total", qty(sum((i) => i.netQty)), money(sum((i) => i.gross)), money(sum((i) => i.revenue)), money(sum((i) => i.cost)), money(sum((i) => i.profit)), ""];
  }

  if (type === "gst") {
    title = "GST summary (for your CA / GSTR-1 & 3B)";
    const [saleItems, purItems, returns] = await Promise.all([
      db.saleItem.findMany({ where: { sale: { date: range, status: { not: "CANCELLED" } } }, include: { sale: { select: { interState: true } } } }),
      db.purchaseItem.findMany({ where: { purchase: { date: range } } }),
      db.saleReturn.aggregate({ where: { date: range }, _sum: { total: true } }),
    ]);
    const byRate = new Map<number, { taxable: number; cgst: number; sgst: number; igst: number }>();
    const byHsn = new Map<string, { qty: number; taxable: number; tax: number; rate: number }>();
    for (const i of saleItems) {
      const r = byRate.get(i.gstRate) ?? { taxable: 0, cgst: 0, sgst: 0, igst: 0 };
      r.taxable += i.taxableValue;
      if (i.sale.interState) r.igst += i.taxAmount;
      else { r.cgst += i.taxAmount / 2; r.sgst += i.taxAmount / 2; }
      byRate.set(i.gstRate, r);
      const k = `${i.hsn ?? "—"}|${i.gstRate}`;
      const h = byHsn.get(k) ?? { qty: 0, taxable: 0, tax: 0, rate: i.gstRate };
      h.qty += i.qty; h.taxable += i.taxableValue; h.tax += i.taxAmount;
      byHsn.set(k, h);
    }
    const inputTax = round2(purItems.reduce((a, i) => a + i.taxAmount, 0));
    const outputTax = round2(saleItems.reduce((a, i) => a + i.taxAmount, 0));
    stats = [
      { label: "Output GST (on sales)", value: money(outputTax) },
      { label: "Input GST (on purchases)", value: money(inputTax) },
      { label: "Approx. GST payable", value: money(outputTax - inputTax), tone: "warn" },
      { label: "Sales returns (credit notes)", value: money(returns._sum.total) },
    ];
    head = ["GST rate", "Taxable value", "CGST", "SGST", "IGST", "Total tax"];
    rows = [...byRate.entries()].sort((a, b) => a[0] - b[0]).map(([rate, r]) => [`${rate}%`, money(r.taxable), money(r.cgst), money(r.sgst), money(r.igst), money(r.cgst + r.sgst + r.igst)]);
    const hsnRows = [...byHsn.entries()].map(([k, h]) => [k.split("|")[0], `${h.rate}%`, qty(h.qty), money(h.taxable), money(h.tax)]);
    return (
      <ReportShell sp={sp} type={type} from={from} to={to} presets={presets} stats={stats}>
        <ReportTable title={title} head={head} rows={rows} filename={`gst-rate-${from}-${to}.csv`} />
        <div className="mt-5" />
        <ReportTable title="HSN-wise summary" head={["HSN", "Rate", "Qty", "Taxable value", "Tax"]} rows={hsnRows} filename={`gst-hsn-${from}-${to}.csv`} />
        <p className="mt-3 text-xs text-gray-500">Returns are not deducted above – adjust them as credit notes. This is a helper summary; final filing should be checked by your CA.</p>
      </ReportShell>
    );
  }

  if (type === "purchases") {
    title = "Purchases by supplier";
    const p = await db.purchase.findMany({ where: { date: range }, include: { supplier: { select: { name: true } } } });
    const g = groupSum(p, (x) => x.supplier.name, (x) => ({ bills: 1, subtotal: x.subtotal, tax: x.taxTotal, total: x.total, paid: x.paidAmount }));
    head = ["Supplier", "Bills", "Value excl. GST", "GST (input)", "Total", "Paid"];
    rows = g.sort((a, b) => b.v.total - a.v.total).map((r) => [r.key, r.v.bills, money(r.v.subtotal), money(r.v.tax), money(r.v.total), money(r.v.paid)]);
    totals = ["Total", p.length, money(p.reduce((a, x) => a + x.subtotal, 0)), money(p.reduce((a, x) => a + x.taxTotal, 0)), money(p.reduce((a, x) => a + x.total, 0)), money(p.reduce((a, x) => a + x.paidAmount, 0))];
  }

  if (type === "payments") {
    title = "Collections by payment mode";
    const p = await db.payment.findMany({ where: { date: range }, select: { method: true, amount: true } });
    const g = groupSum(p, (x) => x.method, (x) => ({ received: Math.max(0, x.amount), refunded: Math.max(0, -x.amount), count: 1 }));
    head = ["Mode", "Transactions", "Received", "Refunded", "Net"];
    rows = g.map((r) => [r.key, r.v.count, money(r.v.received), money(r.v.refunded), money(r.v.received - r.v.refunded)]);
  }

  if (type === "staff") {
    title = "Staff performance";
    const users = await db.user.findMany({ select: { id: true, name: true } });
    const names = new Map(users.map((u) => [String(u.id), u.name]));
    const bills = await db.sale.groupBy({ by: ["userId"], where: { date: range, status: { not: "CANCELLED" } }, _count: true });
    const bc = new Map(bills.map((b) => [String(b.userId), b._count]));
    const jobs = await db.jobCard.groupBy({ by: ["technicianId"], where: { deliveredAt: range }, _count: true });
    const jc = new Map(jobs.map((b) => [String(b.technicianId), b._count]));
    const g = groupSum(items, (i) => String(i.sale.userId), (i) => ({ gross: i.gross, profit: i.profit, qty: i.netQty }));
    head = ["Staff", "Bills", "Items sold", "Sales", "Avg bill", "Profit", "Jobs delivered"];
    rows = g.sort((a, b) => b.v.gross - a.v.gross).map((r) => [names.get(r.key) ?? "—", bc.get(r.key) ?? 0, qty(r.v.qty), money(r.v.gross), money((bc.get(r.key) ?? 0) ? r.v.gross / bc.get(r.key)! : 0), money(r.v.profit), jc.get(r.key) ?? 0]);
  }

  if (type === "customers") {
    title = "Top customers";
    const cust = await db.customer.findMany({ select: { id: true, name: true, phone: true } });
    const cm = new Map(cust.map((c) => [String(c.id), c]));
    const withC = items.filter((i) => i.sale.customerId);
    const visits = new Map<string, Set<number>>();
    for (const i of withC) {
      const k = String(i.sale.customerId);
      visits.set(k, (visits.get(k) ?? new Set()).add(i.saleId));
    }
    const g = groupSum(withC, (i) => String(i.sale.customerId), (i) => ({ gross: i.gross, profit: i.profit }));
    head = ["Customer", "Phone", "Visits", "Spent", "Profit"];
    rows = g.sort((a, b) => b.v.gross - a.v.gross).slice(0, 100).map((r) => [cm.get(r.key)?.name, cm.get(r.key)?.phone, visits.get(r.key)?.size ?? 0, money(r.v.gross), money(r.v.profit)]);
    const walkIn = sum((i) => (i.sale.customerId ? 0 : i.gross));
    stats = [
      { label: "Sales to known customers", value: money(sum((i) => (i.sale.customerId ? i.gross : 0))) },
      { label: "Walk-in sales", value: money(walkIn) },
    ];
  }

  if (type === "dues") {
    const [cd, sb] = await Promise.all([customerDues(), supplierBalances()]);
    return (
      <ReportShell sp={sp} type={type} from={from} to={to} presets={presets} hideDates
        stats={[{ label: "Receivable from customers", value: money(cd.reduce((a, c) => a + c.due, 0)), tone: "warn" }, { label: "Payable to suppliers", value: money(sb.reduce((a, s) => a + Math.max(0, s.balance), 0)), tone: "warn" }]}>
        <div className="grid gap-5 lg:grid-cols-2">
          <ReportTable title="Customer dues" head={["Customer", "Phone", "Due"]} rows={cd.map((c) => [c.name, c.phone, money(c.due)])} filename="customer-dues.csv" />
          <ReportTable title="Supplier balances" head={["Supplier", "Phone", "Balance"]} rows={sb.filter((s) => s.balance > 0.5).sort((a, b) => b.balance - a.balance).map((s) => [s.name, s.phone, money(s.balance)])} filename="supplier-dues.csv" />
        </div>
      </ReportShell>
    );
  }

  if (type === "warranty") {
    title = "Warranties expiring";
    const until = new Date(Date.now() + Number(sp.days || 60) * 864e5);
    const w = await db.saleItem.findMany({
      where: { warrantyUntil: { gte: new Date(), lte: until }, sale: { status: { not: "CANCELLED" } } },
      include: { sale: { select: { invoiceNo: true, date: true, customerName: true, customerPhone: true } } },
      orderBy: { warrantyUntil: "asc" },
    });
    head = ["Product", "Customer", "Phone", "Invoice", "Bought", "Warranty till"];
    rows = w.map((i) => [i.name, i.sale.customerName, i.sale.customerPhone, i.sale.invoiceNo, fmtDate(i.sale.date), fmtDate(i.warrantyUntil)]);
    return (
      <ReportShell sp={sp} type={type} from={from} to={to} presets={presets} hideDates>
        <form className="mb-4 flex items-end gap-2 no-print"><input type="hidden" name="type" value="warranty" /><label><span className="label">Expiring within (days)</span><input name="days" type="number" defaultValue={sp.days || 60} className="input w-28" /></label><button className="btn-dark">Show</button></form>
        <ReportTable title={title} head={head} rows={rows} filename="warranties.csv" />
      </ReportShell>
    );
  }

  return (
    <ReportShell sp={sp} type={type} from={from} to={to} presets={presets} stats={stats}>
      {chart && <Section title={title} className="mb-5"><BarChart data={chart} labelEvery={chart.length > 20 ? 3 : 1} /></Section>}
      <ReportTable title={title} head={head} rows={rows} totals={totals} filename={`${type}-${from}-${to}.csv`} />
    </ReportShell>
  );
}

function ReportShell({ sp, type, from, to, presets, stats = [], hideDates, children }: {
  sp: Record<string, string | undefined>; type: string; from: string; to: string; presets: [string, string, string][];
  stats?: { label: string; value: string; tone?: "good" | "bad" | "warn" }[]; hideDates?: boolean; children: React.ReactNode;
}) {
  return (
    <>
      <PageHeader title="Reports" subtitle={hideDates ? undefined : `${fmtDate(`${from}T12:00:00+05:30`)} – ${fmtDate(`${to}T12:00:00+05:30`)}`} actions={<PrintButton />} />
      <div className="mb-4 flex flex-wrap gap-1.5 no-print">
        {TABS.map(([k, l]) => (
          <Link key={k} href={`/reports?type=${k}${sp.from ? `&from=${sp.from}` : ""}${sp.to ? `&to=${sp.to}` : ""}`} className={k === type ? "btn-dark btn-sm" : "btn-outline btn-sm"}>{l}</Link>
        ))}
      </div>
      {!hideDates && (
        <form className="card mb-4 flex flex-wrap items-end gap-3 p-3 no-print">
          <input type="hidden" name="type" value={type} />
          <label><span className="label">From</span><input type="date" name="from" defaultValue={from} className="input" /></label>
          <label><span className="label">To</span><input type="date" name="to" defaultValue={to} className="input" /></label>
          <button className="btn-dark">Apply</button>
          <div className="flex flex-wrap gap-1.5">
            {presets.map(([l, f, t]) => <Link key={l} className="btn-ghost btn-sm" href={`/reports?type=${type}&from=${f}&to=${t}`}>{l}</Link>)}
          </div>
        </form>
      )}
      {stats.length > 0 && (
        <div className="mb-5 grid grid-cols-2 gap-3 lg:grid-cols-4">{stats.map((s) => <Stat key={s.label} label={s.label} value={s.value} tone={s.tone} />)}</div>
      )}
      {children}
    </>
  );
}

function ReportTable({ title, head, rows, totals, filename }: { title: string; head: string[]; rows: Row[]; totals?: Row | null; filename: string }) {
  return (
    <Section title={title} pad={false} actions={<ExportCsv rows={[head, ...rows, ...(totals ? [totals] : [])]} filename={filename} label="Export" />}>
      <TableWrap>
        <table className="table">
          <thead><tr>{head.map((h, i) => <th key={i} className={i ? "text-right" : ""}>{h}</th>)}</tr></thead>
          <tbody>
            {rows.map((r, i) => (
              <tr key={i}>{r.map((c, j) => <td key={j} className={j ? "text-right tabular-nums" : ""}>{c}</td>)}</tr>
            ))}
            {totals && <tr className="bg-gray-50 font-bold">{totals.map((c, j) => <td key={j} className={j ? "text-right tabular-nums" : ""}>{c}</td>)}</tr>}
          </tbody>
        </table>
      </TableWrap>
      {!rows.length && <p className="p-6 text-center text-sm text-gray-500">No data for this period.</p>}
    </Section>
  );
}
