import Link from "next/link";
import { notFound } from "next/navigation";
import { db } from "@/lib/db";
import { requirePage } from "@/lib/auth";
import { fmtDate, money, round2 } from "@/lib/format";
import { Badge, PageHeader, Section, Stat, TableWrap } from "@/components/ui";
import { Toggle } from "@/components/forms";
import { SupplierForm } from "@/components/supplier-form";
import { PaymentForm } from "@/components/payment-form";
import { addSupplierPayment } from "@/actions/purchases";

export async function generateMetadata({ params }: { params: Promise<{ id: string }> }) {
  const r = await db.supplier.findUnique({ where: { id: Number((await params).id) || 0 }, select: { name: true } });
  return { title: r?.name ?? "Supplier" };
}

export default async function SupplierPage({ params }: { params: Promise<{ id: string }> }) {
  await requirePage("suppliers");
  const id = Number((await params).id);
  const s = await db.supplier.findUnique({
    where: { id },
    include: {
      purchases: { orderBy: { date: "desc" }, include: { returns: { select: { total: true } } } },
      payments: { orderBy: { date: "desc" }, include: { purchase: { select: { number: true } } } },
      returns: { orderBy: { date: "desc" } },
      products: { select: { id: true, name: true, stock: true }, take: 50, orderBy: { name: "asc" } },
    },
  });
  if (!s) notFound();
  const purchased = s.purchases.reduce((a, p) => a + p.total, 0);
  const paid = s.payments.reduce((a, p) => a + p.amount, 0);
  const returned = s.returns.reduce((a, p) => a + p.total, 0);
  const balance = round2(s.openingBalance + purchased - paid - returned);

  return (
    <>
      <PageHeader title={s.name} subtitle={[s.contactPerson, s.phone, s.gstin].filter(Boolean).join(" · ")} back="/suppliers"
        actions={<Link className="btn-primary" href={`/purchases/new?supplier=${s.id}`}>+ New purchase</Link>} />
      <div className="mb-5 grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Stat label="Total purchased" value={money(purchased)} hint={`${s.purchases.length} bills`} />
        <Stat label="Paid" value={money(paid)} />
        <Stat label="Returns" value={money(returned)} />
        <Stat label="Balance due" value={money(balance)} tone={balance > 0.5 ? "warn" : "good"} hint={s.openingBalance ? `incl. opening ${money(s.openingBalance)}` : undefined} />
      </div>
      <div className="grid gap-5 xl:grid-cols-[1fr_420px]">
        <div className="space-y-5">
          <Section title="Purchase bills" pad={false}>
            <TableWrap>
              <table className="table">
                <thead><tr><th>No.</th><th>Date</th><th>Supplier bill</th><th className="text-right">Total</th><th className="text-right">Paid</th><th>Status</th></tr></thead>
                <tbody>
                  {s.purchases.map((p) => {
                    const due = round2(p.total - p.returns.reduce((a, r) => a + r.total, 0) - p.paidAmount);
                    return (
                      <tr key={p.id}>
                        <td><Link className="link" href={`/purchases/${p.id}`}>{p.number}</Link></td>
                        <td className="text-sm">{fmtDate(p.date)}</td>
                        <td className="text-sm">{p.supplierBillNo}</td>
                        <td className="text-right tabular-nums">{money(p.total)}</td>
                        <td className="text-right tabular-nums">{money(p.paidAmount)}</td>
                        <td><Badge status={due <= 0.5 ? "PAID" : p.paidAmount > 0 ? "PARTIAL" : "UNPAID"} /></td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </TableWrap>
          </Section>
          <Section title="Payments made" pad={false}>
            <TableWrap>
              <table className="table">
                <thead><tr><th>Date</th><th>Against</th><th>Method</th><th>Reference</th><th className="text-right">Amount</th></tr></thead>
                <tbody>
                  {s.payments.map((p) => (
                    <tr key={p.id}>
                      <td className="text-sm">{fmtDate(p.date)}</td>
                      <td className="text-sm">{p.purchase?.number ?? "On account"}</td>
                      <td className="text-sm">{p.method}</td>
                      <td className="text-sm">{p.reference}</td>
                      <td className="text-right tabular-nums">{money(p.amount)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </TableWrap>
          </Section>
        </div>
        <div className="space-y-5">
          <Section title="Pay supplier">
            <p className="mb-3 text-xs text-gray-500">Applied to the oldest unpaid bills first.</p>
            <PaymentForm action={addSupplierPayment} hidden={{ supplierId: s.id }} defaultAmount={balance} />
          </Section>
          <Section title="Supplier details">
            <Toggle label="Edit details"><SupplierForm s={s} /></Toggle>
            {s.address && <p className="mt-3 text-sm text-gray-600">{s.address}</p>}
          </Section>
          {s.products.length > 0 && (
            <Section title="Products supplied" pad={false}>
              <ul className="divide-y divide-gray-100 text-sm">
                {s.products.map((p) => (
                  <li key={p.id} className="flex justify-between px-4 py-2"><Link className="link" href={`/products/${p.id}`}>{p.name}</Link><span className="tabular-nums">{p.stock}</span></li>
                ))}
              </ul>
            </Section>
          )}
        </div>
      </div>
    </>
  );
}
