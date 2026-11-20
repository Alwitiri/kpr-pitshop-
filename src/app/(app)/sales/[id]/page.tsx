import Link from "next/link";
import { notFound } from "next/navigation";
import { db } from "@/lib/db";
import { requirePage } from "@/lib/auth";
import { getSettings } from "@/lib/server-utils";
import { can, canSeeProfit } from "@/lib/roles";
import { fmtDate, fmtDateTime, money, qty, round2 } from "@/lib/format";
import { label } from "@/lib/calc";
import { Badge, PageHeader, Section, TableWrap } from "@/components/ui";
import { ActionForm, Submit, Toggle } from "@/components/forms";
import { PaymentForm } from "@/components/payment-form";
import { addSalePayment, cancelSale, createSaleReturn } from "@/actions/sales";
import { WhatsAppButton } from "@/components/whatsapp-button";
import { ReceiptButton } from "@/components/receipt-print";

export async function generateMetadata({ params }: { params: Promise<{ id: string }> }) {
  const r = await db.sale.findUnique({ where: { id: Number((await params).id) || 0 }, select: { invoiceNo: true } });
  return { title: r?.invoiceNo ?? "Invoice" };
}

export default async function SalePage({ params }: { params: Promise<{ id: string }> }) {
  const s = await requirePage("sales");
  const id = Number((await params).id);
  const shop = await getSettings();
  const sale = await db.sale.findUnique({
    where: { id },
    include: {
      items: true,
      payments: { orderBy: { date: "asc" } },
      returns: { orderBy: { date: "asc" } },
      customer: true,
      vehicle: true,
      user: { select: { name: true } },
      jobCard: { select: { id: true, number: true } },
    },
  });
  if (!sale) notFound();
  const net = round2(sale.total - sale.returnedAmount);
  const due = sale.status === "CANCELLED" ? 0 : round2(net - sale.paidAmount);
  const profit = canSeeProfit(s.role);
  const canManage = can(s.role, "manageSales");
  const returnable = sale.items.filter((i) => i.qty - i.returnedQty > 0);

  return (
    <>
      <PageHeader
        title={<span className="flex items-center gap-3">Invoice {sale.invoiceNo} <Badge status={sale.status} /></span>}
        subtitle={`${fmtDateTime(sale.date)} · billed by ${sale.user?.name ?? "—"}`}
        back="/sales"
        actions={
          <>
            {sale.status !== "CANCELLED" && <WhatsAppButton kind="INVOICE" saleId={sale.id} label="Send on WhatsApp" />}
            <ReceiptButton saleId={sale.id} label={`Print receipt (${shop.receiptWidth.replace("mm", " mm")})`} />
            <a className="btn-dark" href={`/print/invoice/${sale.id}?size=a4`} target="_blank">Print A4 invoice</a>
          </>
        }
      />
      {sale.status === "CANCELLED" && (
        <div className="mb-4 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          Cancelled on {fmtDateTime(sale.cancelledAt)} – {sale.cancelReason}
        </div>
      )}
      <div className="grid gap-5 xl:grid-cols-[1fr_400px]">
        <div className="space-y-5">
          <Section title="Items" pad={false}>
            <TableWrap>
              <table className="table">
                <thead><tr><th>Item</th><th>HSN</th><th className="text-right">Qty</th><th className="text-right">Rate</th><th className="text-right">Disc</th><th className="text-right">Taxable</th><th className="text-right">GST</th><th className="text-right">Amount</th>{profit && <th className="text-right">Margin</th>}</tr></thead>
                <tbody>
                  {sale.items.map((i) => (
                    <tr key={i.id}>
                      <td>
                        {i.productId ? <Link className="link" href={`/products/${i.productId}`}>{i.name}</Link> : i.name}
                        {i.returnedQty > 0 && <div className="text-xs text-red-600">{qty(i.returnedQty)} returned</div>}
                        {i.warrantyUntil && <div className="text-xs text-gray-500">Warranty till {fmtDate(i.warrantyUntil)}</div>}
                      </td>
                      <td className="text-xs">{i.hsn}</td>
                      <td className="text-right tabular-nums">{qty(i.qty)}</td>
                      <td className="text-right tabular-nums">{money(i.unitPrice)}</td>
                      <td className="text-right tabular-nums">{i.discount ? money(i.discount) : "—"}</td>
                      <td className="text-right tabular-nums">{money(i.taxableValue)}</td>
                      <td className="text-right tabular-nums text-xs">{money(i.taxAmount)} ({i.gstRate}%)</td>
                      <td className="text-right font-medium tabular-nums">{money(i.total)}</td>
                      {profit && <td className="text-right text-xs tabular-nums text-emerald-700">{i.productId ? money(i.taxableValue - i.costPrice * i.qty) : "—"}</td>}
                    </tr>
                  ))}
                </tbody>
              </table>
            </TableWrap>
            <dl className="ml-auto max-w-xs space-y-1 p-4 text-sm">
              <div className="flex justify-between"><dt>Items total</dt><dd>{money(sale.subtotal)}</dd></div>
              {sale.discount > 0 && <div className="flex justify-between text-emerald-700"><dt>Discount</dt><dd>− {money(sale.discount)}</dd></div>}
              <div className="flex justify-between text-gray-500"><dt>Taxable value</dt><dd>{money(sale.taxableValue)}</dd></div>
              {sale.interState ? (
                <div className="flex justify-between text-gray-500"><dt>IGST</dt><dd>{money(sale.igst)}</dd></div>
              ) : (
                <>
                  <div className="flex justify-between text-gray-500"><dt>CGST</dt><dd>{money(sale.cgst)}</dd></div>
                  <div className="flex justify-between text-gray-500"><dt>SGST</dt><dd>{money(sale.sgst)}</dd></div>
                </>
              )}
              {sale.roundOff !== 0 && <div className="flex justify-between text-gray-500"><dt>Round off</dt><dd>{sale.roundOff.toFixed(2)}</dd></div>}
              <div className="flex justify-between border-t pt-1 text-base font-bold"><dt>Total</dt><dd>{money(sale.total)}</dd></div>
              {sale.returnedAmount > 0 && <div className="flex justify-between text-red-600"><dt>Returned</dt><dd>− {money(sale.returnedAmount)}</dd></div>}
              <div className="flex justify-between"><dt>Paid</dt><dd>{money(sale.paidAmount)}</dd></div>
              {due > 0.5 && <div className="flex justify-between font-semibold text-amber-700"><dt>Due</dt><dd>{money(due)}</dd></div>}
              {profit && sale.status !== "CANCELLED" && <div className="flex justify-between border-t pt-1 text-xs text-gray-500"><dt>Est. profit (before returns)</dt><dd>{money(sale.taxableValue - sale.costTotal)}</dd></div>}
            </dl>
            {sale.notes && <p className="border-t px-4 py-3 text-sm text-gray-600">Note: {sale.notes}</p>}
          </Section>

          <Section title="Payments & refunds" pad={false}>
            <table className="table">
              <tbody>
                {sale.payments.map((p) => (
                  <tr key={p.id}>
                    <td className="text-sm">{fmtDateTime(p.date)}</td>
                    <td className="text-sm">{p.method}</td>
                    <td className="text-xs text-gray-500">{[p.reference, p.note].filter(Boolean).join(" · ")}</td>
                    <td className={`text-right tabular-nums ${p.amount < 0 ? "text-red-600" : ""}`}>{money(p.amount)}</td>
                  </tr>
                ))}
                {!sale.payments.length && <tr><td className="text-sm text-gray-500">No payment – full credit.</td></tr>}
              </tbody>
            </table>
          </Section>

          {sale.returns.length > 0 && (
            <Section title="Returns" pad={false}>
              <table className="table">
                <tbody>
                  {sale.returns.map((r) => (
                    <tr key={r.id}>
                      <td className="font-mono text-xs">{r.number}</td>
                      <td className="text-sm">{fmtDateTime(r.date)}</td>
                      <td className="text-xs">{(JSON.parse(r.items) as { name: string; qty: number }[]).map((i) => `${i.name} × ${i.qty}`).join(", ")}</td>
                      <td className="text-xs">{label(r.refundMethod)}</td>
                      <td className="text-right tabular-nums">{money(r.total)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </Section>
          )}
        </div>

        <div className="space-y-5">
          <Section title="Customer">
            {sale.customer ? (
              <div className="text-sm">
                <Link className="link text-base" href={`/customers/${sale.customer.id}`}>{sale.customer.name}</Link>
                <div className="text-gray-500">{sale.customer.phone}</div>
                {sale.vehicle && <div className="mt-1">{sale.vehicle.make} {sale.vehicle.model} {sale.vehicle.regNo && `· ${sale.vehicle.regNo}`}</div>}
              </div>
            ) : (
              <p className="text-sm text-gray-500">{sale.customerName ?? "Walk-in customer"}</p>
            )}
            {sale.jobCard && <p className="mt-2 text-sm">Job card: <Link className="link" href={`/jobcards/${sale.jobCard.id}`}>{sale.jobCard.number}</Link></p>}
          </Section>

          {due > 0.5 && (
            <Section title={`Receive payment · ${money(due)} due`}>
              <PaymentForm action={addSalePayment} hidden={{ saleId: sale.id }} defaultAmount={due} submitLabel="Receive payment" />
            </Section>
          )}

          {sale.status !== "CANCELLED" && returnable.length > 0 && (
            <Section title="Return / exchange items">
              <Toggle label="Return items">
                <ActionForm action={createSaleReturn} className="space-y-3">
                  <input type="hidden" name="saleId" value={sale.id} />
                  {returnable.map((i) => (
                    <label key={i.id} className="flex items-center justify-between gap-3 text-sm">
                      <span className="min-w-0 truncate">{i.name} <span className="text-xs text-gray-400">(max {qty(i.qty - i.returnedQty)})</span></span>
                      <input name={`ret_${i.id}`} type="number" min="0" max={i.qty - i.returnedQty} step="1" className="input w-20 py-1" />
                    </label>
                  ))}
                  <label className="block">
                    <span className="label">Refund by</span>
                    <select name="refundMethod" className="input">
                      <option value="CASH">Cash refund</option><option value="UPI">UPI refund</option><option value="CARD">Card refund</option>
                      <option value="ADJUST_DUE">Adjust against dues / for exchange</option>
                    </select>
                  </label>
                  <label className="block">
                    <span className="label">Put back in stock?</span>
                    <select name="restock" className="input"><option value="yes">Yes – item is resellable</option><option value="no">No – damaged / defective</option></select>
                  </label>
                  <input name="reason" className="input" placeholder="Reason (size issue, defective…)" />
                  <Submit className="btn-danger" confirm="Save this return?">Save return</Submit>
                </ActionForm>
              </Toggle>
            </Section>
          )}

          {canManage && sale.status !== "CANCELLED" && sale.returns.length === 0 && (
            <Section title="Cancel bill">
              <Toggle label="Cancel this bill" className="btn-danger">
                <ActionForm action={cancelSale} className="space-y-3">
                  <input type="hidden" name="saleId" value={sale.id} />
                  <input name="reason" className="input" placeholder="Reason for cancelling *" required />
                  {sale.paidAmount > 0 && (
                    <label className="block">
                      <span className="label">Refund {money(sale.paidAmount)} by</span>
                      <select name="refundMethod" className="input"><option>CASH</option><option>UPI</option><option>CARD</option></select>
                    </label>
                  )}
                  <Submit className="btn-danger" confirm="Cancel this bill? Stock will be restored. This cannot be undone.">Confirm cancel</Submit>
                </ActionForm>
              </Toggle>
            </Section>
          )}
        </div>
      </div>
    </>
  );
}
