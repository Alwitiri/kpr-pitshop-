import { notFound } from "next/navigation";
import { db } from "@/lib/db";
import { requirePage } from "@/lib/auth";
import { getSettings } from "@/lib/server-utils";
import { amountInWords, fmtDate, fmtDateTime, qty } from "@/lib/format";
import { gstSummary } from "@/lib/calc";
import { AutoPrint } from "./auto-print";
import { Barcode } from "@/components/barcode";

export const metadata = { title: "Invoice" };

const r2 = (n: number) => n.toFixed(2);

export default async function InvoicePrint({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<{ size?: string; silent?: string; frame?: string; preview?: string }> }) {
  await requirePage();
  const id = Number((await params).id);
  const sp = await searchParams;
  const silent = sp.silent === "1";
  const frame = sp.frame === "1";
  const preview = sp.preview === "1"; // show only, do not print
  const [sale, shop] = await Promise.all([
    db.sale.findUnique({ where: { id }, include: { items: true, payments: true, customer: true, vehicle: true, user: { select: { name: true } } } }),
    getSettings(),
  ]);
  if (!sale) notFound();
  // "receipt" = the shop's receipt paper from Settings (80 mm or 58 mm)
  const size = sp.size === "a4" ? "a4" : sp.size === "58mm" || sp.size === "80mm" ? sp.size : shop.receiptWidth === "58mm" ? "58mm" : "80mm";
  const logo = shop.logoFile ? `/api/logo?v=${encodeURIComponent(shop.logoFile)}` : null;
  const summary = gstSummary(sale.items);
  const paidBy = [...new Set(sale.payments.filter((p) => p.amount > 0).map((p) => p.method))].join(" + ") || "Credit";
  const due = sale.total - sale.returnedAmount - sale.paidAmount;
  const custName = sale.customer?.name ?? sale.customerName;
  const vehicle = sale.vehicle ? `${sale.vehicle.make} ${sale.vehicle.model ?? ""} ${sale.vehicle.regNo ?? ""}`.trim() : null;
  const warranties = sale.items.filter((i) => i.warrantyUntil);

  if (size !== "a4") {
    // 80 mm paper prints about 72 mm wide; 58 mm paper about 48 mm – keep text inside that.
    const narrow = size === "58mm";
    return (
      <div className={`mx-auto bg-white font-mono leading-tight text-black ${narrow ? "w-[184px] px-0.5 py-1 text-[9.5px]" : "w-[302px] p-2 text-[11px]"}`}>
        <style>{`@page { size: ${size} auto; margin: 0 } body { background: white } html, body { min-height: 0 !important }`}</style>
        {!preview && <AutoPrint silent={silent} frame={frame} />}
        <div className="text-center">
          {logo && (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={logo} alt="" className={`mx-auto mb-1 w-auto object-contain grayscale ${narrow ? "h-11 max-w-[55%]" : "h-16 max-w-[60%]"}`} />
          )}
          <div className={`font-bold ${narrow ? "text-[12px]" : "text-base"}`}>{shop.shopName}</div>
          {shop.tagline && <div>{shop.tagline}</div>}
          {shop.address && <div>{shop.address}</div>}
          {shop.phone && <div>Ph: {shop.phone}</div>}
          {shop.gstin && <div>GSTIN: {shop.gstin}</div>}
          <div className="my-1 border-y border-dashed border-black py-0.5 font-bold">{sale.status === "CANCELLED" ? "CANCELLED " : ""}TAX INVOICE</div>
        </div>
        <div className={narrow ? "" : "flex justify-between"}><div>Bill: {sale.invoiceNo}</div><div>{fmtDate(sale.date)}</div></div>
        <div>Time: {new Date(sale.date).toLocaleTimeString("en-IN", { timeZone: "Asia/Kolkata", hour: "2-digit", minute: "2-digit" })} · By: {sale.user?.name}</div>
        {custName && <div>Customer: {custName}{sale.customerPhone ? ` (${sale.customerPhone})` : ""}</div>}
        {vehicle && <div>Vehicle: {vehicle}</div>}
        <div className="my-1 border-t border-dashed border-black" />
        {narrow ? (
          // 58 mm: name on its own line, then "qty x rate ........ amount"
          <div>
            {sale.items.map((i) => (
              <div key={i.id} className="mb-0.5">
                <div className="break-words">{i.name}</div>
                <div className="flex justify-between gap-1"><span>{qty(i.qty)} x {r2(i.unitPrice)}{i.discount > 0 ? ` -${r2(i.discount)}` : ""}</span><span>{r2(i.total)}</span></div>
              </div>
            ))}
          </div>
        ) : (
          <table className="w-full">
            <thead><tr className="text-left"><th>Item</th><th className="pl-1.5 text-right">Qty</th><th className="pl-1.5 text-right">Rate</th><th className="pl-1.5 text-right">Amt</th></tr></thead>
            <tbody>
              {sale.items.map((i) => (
                <tr key={i.id} className="align-top">
                  <td className="pr-1">{i.name}{i.discount > 0 && <div>  disc -{r2(i.discount)}</div>}</td>
                  <td className="whitespace-nowrap pl-1.5 text-right">{qty(i.qty)}</td>
                  <td className="whitespace-nowrap pl-1.5 text-right">{r2(i.unitPrice)}</td>
                  <td className="whitespace-nowrap pl-1.5 text-right">{r2(i.total)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
        <div className="my-1 border-t border-dashed border-black" />
        <Row l="Items total" r={r2(sale.subtotal)} />
        {sale.discount > 0 && <Row l="Discount" r={`-${r2(sale.discount)}`} />}
        <Row l="Taxable" r={r2(sale.taxableValue)} />
        {sale.interState ? <Row l="IGST" r={r2(sale.igst)} /> : <><Row l="CGST" r={r2(sale.cgst)} /><Row l="SGST" r={r2(sale.sgst)} /></>}
        {sale.roundOff !== 0 && <Row l="Round off" r={r2(sale.roundOff)} />}
        <div className={`my-1 flex justify-between border-y border-dashed border-black py-1 font-bold ${narrow ? "text-[11px]" : "text-sm"}`}><span>TOTAL</span><span>₹{r2(sale.total)}</span></div>
        <Row l={`Paid (${paidBy})`} r={r2(sale.paidAmount + Math.max(0, 0))} />
        {sale.returnedAmount > 0 && <Row l="Returned" r={r2(sale.returnedAmount)} />}
        {due > 0.5 && <Row l="BALANCE DUE" r={r2(due)} bold />}
        <div className={`mt-1 ${narrow ? "text-[8.5px]" : "text-[10px]"}`}>{amountInWords(sale.total)}</div>
        <div className="my-1 border-t border-dashed border-black" />
        <table className={`w-full ${narrow ? "text-[8.5px]" : "text-[10px]"}`}>
          <thead><tr><th className="text-left">GST%</th><th className="text-right">Taxable</th><th className="text-right">Tax</th></tr></thead>
          <tbody>{summary.map((g) => <tr key={g.rate}><td>{g.rate}%</td><td className="text-right">{r2(g.taxable)}</td><td className="text-right">{r2(g.tax)}</td></tr>)}</tbody>
        </table>
        {warranties.length > 0 && (
          <>
            <div className="my-1 border-t border-dashed border-black" />
            {warranties.map((w) => <div key={w.id} className="text-[10px]">Warranty: {w.name} till {fmtDate(w.warrantyUntil)}</div>)}
          </>
        )}
        <div className="my-1 border-t border-dashed border-black" />
        <div className="text-center text-[10px]">{shop.invoiceFooter}</div>
        <div className="mt-1 flex justify-center">
          <Barcode value={sale.invoiceNo} height={narrow ? 28 : 34} width={narrow ? 0.95 : 1.3} fontSize={narrow ? 9 : 10} />
        </div>
        <div className="text-center text-[9px]">Keep this bill – scan it for returns / exchange</div>
        <div className="mt-1 text-center font-bold">Thank you! Visit again</div>
      </div>
    );
  }

  // A4 GST invoice
  return (
    <div className="mx-auto max-w-[800px] bg-white p-8 text-[12px] text-black">
      <style>{`@page { size: A4; margin: 12mm } body { background: white }`}</style>
      {!preview && <AutoPrint frame={frame} />}
      <div className="flex items-start justify-between border-b-2 border-black pb-3">
        <div className="flex items-start gap-4">
        {logo && (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={logo} alt="" className="h-20 w-20 object-contain" />
        )}
        <div>
          <div className="text-2xl font-black">{shop.shopName}</div>
          {shop.tagline && <div className="text-gray-700">{shop.tagline}</div>}
          <div className="mt-1 whitespace-pre-line">{shop.address}</div>
          <div>{[shop.phone && `Ph: ${shop.phone}`, shop.email].filter(Boolean).join(" · ")}</div>
          {shop.gstin && <div className="font-semibold">GSTIN: {shop.gstin}</div>}
          <div>State: {shop.stateName} ({shop.stateCode})</div>
        </div>
        </div>
        <div className="text-right">
          <div className="text-xl font-bold">{sale.status === "CANCELLED" ? "CANCELLED – " : ""}TAX INVOICE</div>
          <div className="flex justify-end">
            <Barcode value={sale.invoiceNo} height={32} width={1.2} fontSize={0} displayValue={false} />
          </div>
          <div className="mt-2">Invoice No: <b>{sale.invoiceNo}</b></div>
          <div>Date: {fmtDateTime(sale.date)}</div>
          <div>Place of supply: {sale.interState ? "Outside state (IGST)" : `${shop.stateName} (${shop.stateCode})`}</div>
        </div>
      </div>
      <div className="grid grid-cols-2 gap-4 border-b border-gray-400 py-3">
        <div>
          <div className="text-[10px] font-bold uppercase text-gray-600">Bill to</div>
          <div className="font-semibold">{custName ?? "Walk-in customer"}</div>
          {sale.customer?.address && <div>{sale.customer.address}</div>}
          {(sale.customer?.phone ?? sale.customerPhone) && <div>Ph: {sale.customer?.phone ?? sale.customerPhone}</div>}
          {sale.customer?.gstin && <div>GSTIN: {sale.customer.gstin}</div>}
        </div>
        {vehicle && (
          <div>
            <div className="text-[10px] font-bold uppercase text-gray-600">Vehicle</div>
            <div>{vehicle}</div>
          </div>
        )}
      </div>
      <table className="mt-3 w-full border-collapse">
        <thead>
          <tr className="border-y border-black bg-gray-100 text-left">
            <th className="p-1.5">#</th><th className="p-1.5">Description</th><th className="p-1.5">HSN</th><th className="p-1.5 text-right">Qty</th><th className="p-1.5 text-right">Rate</th>
            <th className="p-1.5 text-right">Disc</th><th className="p-1.5 text-right">Taxable</th><th className="p-1.5 text-right">GST</th><th className="p-1.5 text-right">Amount</th>
          </tr>
        </thead>
        <tbody>
          {sale.items.map((i, ix) => (
            <tr key={i.id} className="border-b border-gray-300 align-top">
              <td className="p-1.5">{ix + 1}</td>
              <td className="p-1.5">{i.name}{i.warrantyUntil && <div className="text-[10px] text-gray-600">Warranty till {fmtDate(i.warrantyUntil)}</div>}</td>
              <td className="p-1.5">{i.hsn}</td>
              <td className="p-1.5 text-right">{qty(i.qty)}</td>
              <td className="p-1.5 text-right">{r2(i.unitPrice)}</td>
              <td className="p-1.5 text-right">{i.discount ? r2(i.discount) : "-"}</td>
              <td className="p-1.5 text-right">{r2(i.taxableValue)}</td>
              <td className="p-1.5 text-right">{r2(i.taxAmount)}<div className="text-[10px]">{i.gstRate}%</div></td>
              <td className="p-1.5 text-right font-semibold">{r2(i.total)}</td>
            </tr>
          ))}
        </tbody>
      </table>
      <div className="mt-3 grid grid-cols-2 gap-6">
        <div>
          <table className="w-full border-collapse text-[11px]">
            <thead><tr className="border-y border-black bg-gray-100"><th className="p-1 text-left">GST rate</th><th className="p-1 text-right">Taxable</th>{sale.interState ? <th className="p-1 text-right">IGST</th> : <><th className="p-1 text-right">CGST</th><th className="p-1 text-right">SGST</th></>}</tr></thead>
            <tbody>
              {summary.map((g) => (
                <tr key={g.rate} className="border-b border-gray-300">
                  <td className="p-1">{g.rate}%</td><td className="p-1 text-right">{r2(g.taxable)}</td>
                  {sale.interState ? <td className="p-1 text-right">{r2(g.tax)}</td> : <><td className="p-1 text-right">{r2(g.tax / 2)}</td><td className="p-1 text-right">{r2(g.tax / 2)}</td></>}
                </tr>
              ))}
            </tbody>
          </table>
          <div className="mt-3"><b>Amount in words:</b> {amountInWords(sale.total)}</div>
          <div className="mt-1">Payment: {paidBy}</div>
          {(shop.bankDetails || shop.upiId) && <div className="mt-2 whitespace-pre-line text-[11px]">{shop.upiId && `UPI: ${shop.upiId}\n`}{shop.bankDetails}</div>}
        </div>
        <div>
          <Row l="Items total" r={r2(sale.subtotal)} />
          {sale.discount > 0 && <Row l="Discount" r={`- ${r2(sale.discount)}`} />}
          <Row l="Taxable value" r={r2(sale.taxableValue)} />
          {sale.interState ? <Row l="IGST" r={r2(sale.igst)} /> : <><Row l="CGST" r={r2(sale.cgst)} /><Row l="SGST" r={r2(sale.sgst)} /></>}
          {sale.roundOff !== 0 && <Row l="Round off" r={r2(sale.roundOff)} />}
          <div className="mt-1 flex justify-between border-y-2 border-black py-1.5 text-base font-bold"><span>Grand total</span><span>₹ {r2(sale.total)}</span></div>
          <Row l="Paid" r={r2(sale.paidAmount)} />
          {sale.returnedAmount > 0 && <Row l="Returned" r={r2(sale.returnedAmount)} />}
          {due > 0.5 && <Row l="Balance due" r={r2(due)} bold />}
        </div>
      </div>
      <div className="mt-10 flex items-end justify-between">
        <div className="max-w-md text-[10px] text-gray-700">{shop.invoiceFooter}</div>
        <div className="text-center"><div className="h-12" /><div className="border-t border-black px-6 pt-1">For {shop.shopName}</div></div>
      </div>
    </div>
  );
}

function Row({ l, r, bold }: { l: string; r: string; bold?: boolean }) {
  return <div className={`flex justify-between ${bold ? "font-bold" : ""}`}><span>{l}</span><span>{r}</span></div>;
}
