import Link from "next/link";
import { notFound } from "next/navigation";
import { db } from "@/lib/db";
import { requirePage } from "@/lib/auth";
import { fmtDate, money, qty, round2 } from "@/lib/format";
import { Badge, PageHeader, Section, TableWrap } from "@/components/ui";
import { ActionForm, PrintButton, Submit, Toggle } from "@/components/forms";
import { PaymentForm } from "@/components/payment-form";
import { addSupplierPayment, createPurchaseReturn } from "@/actions/purchases";

export default async function PurchasePage({ params }: { params: Promise<{ id: string }> }) {
  await requirePage("purchases");
  const id = Number((await params).id);
  const p = await db.purchase.findUnique({
    where: { id },
    include: { supplier: true, items: { include: { product: { select: { name: true, sku: true, stock: true } } } }, payments: { orderBy: { date: "asc" } }, returns: { orderBy: { date: "asc" } } },
  });
  if (!p) notFound();
  const returned = p.returns.reduce((a, r) => a + r.total, 0);
  const due = round2(p.total - returned - p.paidAmount);

  return (
    <>
      <PageHeader
        title={`Purchase ${p.number}`}
        subtitle={<>{fmtDate(p.date)} · <Link className="link" href={`/suppliers/${p.supplierId}`}>{p.supplier.name}</Link>{p.supplierBillNo ? ` · Bill ${p.supplierBillNo}` : ""}</>}
        back="/purchases"
        actions={<><PrintButton />{p.attachmentUrl && <a className="btn-outline" href={p.attachmentUrl} target="_blank">View supplier bill</a>}</>}
      />
      <div className="grid gap-5 xl:grid-cols-[1fr_400px]">
        <div className="space-y-5">
          <Section title="Items" pad={false}>
            <TableWrap>
              <table className="table">
                <thead><tr><th>Product</th><th className="text-right">Qty</th><th className="text-right">Cost</th><th className="text-right">GST</th><th className="text-right">Total</th><th className="text-right">Returned</th></tr></thead>
                <tbody>
                  {p.items.map((i) => (
                    <tr key={i.id}>
                      <td><Link className="link" href={`/products/${i.productId}`}>{i.product.name}</Link><div className="font-mono text-xs text-gray-500">{i.product.sku}</div></td>
                      <td className="text-right tabular-nums">{qty(i.qty)}</td>
                      <td className="text-right tabular-nums">{money(i.unitCost)}</td>
                      <td className="text-right tabular-nums">{money(i.taxAmount)} <span className="text-xs text-gray-400">({i.gstRate}%)</span></td>
                      <td className="text-right tabular-nums">{money(i.total)}</td>
                      <td className="text-right tabular-nums">{i.returnedQty ? qty(i.returnedQty) : "—"}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </TableWrap>
            <dl className="ml-auto max-w-xs space-y-1 p-4 text-sm">
              <div className="flex justify-between"><dt>Subtotal</dt><dd>{money(p.subtotal)}</dd></div>
              <div className="flex justify-between"><dt>GST</dt><dd>{money(p.taxTotal)}</dd></div>
              {p.otherCharges > 0 && <div className="flex justify-between"><dt>Other charges</dt><dd>{money(p.otherCharges)}</dd></div>}
              {p.discount > 0 && <div className="flex justify-between"><dt>Discount</dt><dd>− {money(p.discount)}</dd></div>}
              <div className="flex justify-between border-t pt-1 font-bold"><dt>Total</dt><dd>{money(p.total)}</dd></div>
              {returned > 0 && <div className="flex justify-between"><dt>Returned</dt><dd>− {money(returned)}</dd></div>}
              <div className="flex justify-between"><dt>Paid</dt><dd>{money(p.paidAmount)}</dd></div>
              <div className="flex justify-between font-semibold text-amber-700"><dt>Due</dt><dd>{money(Math.max(0, due))}</dd></div>
            </dl>
            {p.notes && <p className="border-t px-4 py-3 text-sm text-gray-600">Note: {p.notes}</p>}
          </Section>
          {p.payments.length > 0 && (
            <Section title="Payments" pad={false}>
              <table className="table">
                <tbody>
                  {p.payments.map((x) => (
                    <tr key={x.id}><td className="text-sm">{fmtDate(x.date)}</td><td className="text-sm">{x.method}</td><td className="text-sm">{x.reference}</td><td className="text-right tabular-nums">{money(x.amount)}</td></tr>
                  ))}
                </tbody>
              </table>
            </Section>
          )}
        </div>
        <div className="space-y-5 no-print">
          <Section title="Status" actions={<Badge status={due <= 0.5 ? "PAID" : p.paidAmount > 0 ? "PARTIAL" : "UNPAID"} />}>
            {due > 0.5 ? (
              <PaymentForm action={addSupplierPayment} hidden={{ supplierId: p.supplierId, purchaseId: p.id }} defaultAmount={due} />
            ) : (
              <p className="text-sm text-emerald-700">This bill is fully paid.</p>
            )}
          </Section>
          <Section title="Return goods to supplier">
            <Toggle label="Create purchase return">
              <ActionForm action={createPurchaseReturn} className="space-y-3">
                <input type="hidden" name="purchaseId" value={p.id} />
                {p.items.map((i) => (
                  <label key={i.id} className="flex items-center justify-between gap-3 text-sm">
                    <span className="min-w-0 truncate">{i.product.name} <span className="text-xs text-gray-400">(max {qty(Math.min(i.qty - i.returnedQty, i.product.stock))})</span></span>
                    <input name={`ret_${i.id}`} type="number" min="0" max={i.qty - i.returnedQty} step="1" className="input w-20 py-1" />
                  </label>
                ))}
                <input name="note" className="input" placeholder="Reason (damaged, wrong item…)" />
                <Submit className="btn-danger" confirm="Return these items to the supplier? Stock will reduce.">Save return</Submit>
              </ActionForm>
            </Toggle>
            {p.returns.map((r) => (
              <div key={r.id} className="mt-3 rounded-lg bg-gray-50 p-2 text-xs">{r.number} · {fmtDate(r.date)} · {money(r.total)} {r.note && `· ${r.note}`}</div>
            ))}
          </Section>
        </div>
      </div>
    </>
  );
}
