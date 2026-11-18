import Link from "next/link";
import { notFound } from "next/navigation";
import { db } from "@/lib/db";
import { requirePage } from "@/lib/auth";
import { can } from "@/lib/roles";
import { pickerProducts } from "@/lib/queries";
import { fmtDateTime, money, qty } from "@/lib/format";
import { JOB_STATUSES, label } from "@/lib/calc";
import { Badge, PageHeader, Section, TableWrap } from "@/components/ui";
import { ActionForm, PrintButton, Submit, Toggle } from "@/components/forms";
import { ProductPicker } from "@/components/product-picker";
import { addJobPart, removeJobPart, setJobStatus, updateJobCard } from "@/actions/jobcards";

const toLocalInput = (d: Date | null) => (d ? new Date(d.getTime() + 5.5 * 3600e3).toISOString().slice(0, 16) : "");

export default async function JobCardPage({ params }: { params: Promise<{ id: string }> }) {
  const s = await requirePage("jobcards");
  const id = Number((await params).id);
  const j = await db.jobCard.findUnique({
    where: { id },
    include: { customer: true, vehicle: true, technician: { select: { name: true } }, parts: { include: { product: { select: { name: true, stock: true, sku: true } } } }, sale: { select: { id: true, invoiceNo: true, total: true } } },
  });
  if (!j) notFound();
  const [products, techs] = await Promise.all([
    pickerProducts(),
    db.user.findMany({ where: { active: true, role: { in: ["TECHNICIAN", "MANAGER", "OWNER"] } }, select: { id: true, name: true } }),
  ]);
  const partsTotal = j.parts.reduce((a, p) => a + p.qty * p.unitPrice, 0);
  const locked = !!j.sale || j.status === "CANCELLED";
  const flow = ["RECEIVED", "INSPECTION", "IN_PROGRESS", "COMPLETED"];

  return (
    <>
      <PageHeader
        title={<span className="flex items-center gap-3">Job {j.number} <Badge status={j.status} /></span>}
        subtitle={`Received ${fmtDateTime(j.receivedAt)}${j.promisedAt ? ` · Promised ${fmtDateTime(j.promisedAt)}` : ""}`}
        back="/jobcards"
        actions={
          <>
            <PrintButton label="Print job card" />
            {!j.sale && j.status !== "CANCELLED" && can(s.role, "pos") && <Link href={`/pos?job=${j.id}`} className="btn-primary">Create invoice</Link>}
            {j.sale && <Link href={`/sales/${j.sale.id}`} className="btn-outline">Invoice {j.sale.invoiceNo}</Link>}
          </>
        }
      />

      {!locked && (
        <div className="card mb-5 flex flex-wrap items-center gap-2 p-3 no-print">
          <span className="mr-2 text-sm font-medium text-gray-600">Move to:</span>
          {flow.map((st) => (
            <form key={st} action={setJobStatus}>
              <input type="hidden" name="id" value={j.id} />
              <input type="hidden" name="status" value={st} />
              <button className={st === j.status ? "btn-dark btn-sm" : "btn-outline btn-sm"} disabled={st === j.status}>{label(st)}</button>
            </form>
          ))}
          <form action={setJobStatus} className="ml-auto">
            <input type="hidden" name="id" value={j.id} />
            <input type="hidden" name="status" value="CANCELLED" />
            <Submit className="btn-ghost btn-sm text-red-600" confirm="Cancel this job card?">Cancel job</Submit>
          </form>
        </div>
      )}

      <div className="grid gap-5 xl:grid-cols-[1fr_400px]">
        <div className="space-y-5">
          <Section title="Customer & vehicle">
            <div className="grid gap-4 text-sm sm:grid-cols-2">
              <div>
                <Link className="link text-base" href={`/customers/${j.customerId}`}>{j.customer.name}</Link>
                <div className="text-gray-500">{j.customer.phone}</div>
              </div>
              <div>
                {j.vehicle ? (<><div className="font-semibold">{j.vehicle.make} {j.vehicle.model}</div><div className="font-mono text-xs">{j.vehicle.regNo}</div></>) : "—"}
                {j.odometer && <div className="text-xs text-gray-500">Odometer: {j.odometer} km</div>}
              </div>
            </div>
            <div className="mt-4 rounded-lg bg-gray-50 p-3 text-sm"><div className="label">Work required</div>{j.complaint}</div>
            {j.diagnosis && <div className="mt-3 rounded-lg bg-gray-50 p-3 text-sm"><div className="label">Technician notes</div>{j.diagnosis}</div>}
          </Section>

          <Section title="Parts / accessories used" pad={false}>
            <TableWrap>
              <table className="table">
                <thead><tr><th>Item</th><th className="text-right">Qty</th><th className="text-right">Price</th><th className="text-right">Amount</th><th className="text-right">In stock</th><th /></tr></thead>
                <tbody>
                  {j.parts.map((p) => (
                    <tr key={p.id}>
                      <td>{p.product.name}<div className="font-mono text-xs text-gray-500">{p.product.sku}</div></td>
                      <td className="text-right tabular-nums">{qty(p.qty)}</td>
                      <td className="text-right tabular-nums">{money(p.unitPrice)}</td>
                      <td className="text-right tabular-nums">{money(p.qty * p.unitPrice)}</td>
                      <td className={`text-right tabular-nums ${p.product.stock < p.qty ? "text-red-600" : ""}`}>{qty(p.product.stock)}</td>
                      <td>{!locked && <form action={removeJobPart}><input type="hidden" name="id" value={p.id} /><button className="text-xs text-gray-400 hover:text-red-600">Remove</button></form>}</td>
                    </tr>
                  ))}
                  <tr><td colSpan={3} className="text-right">Labour / fitting</td><td className="text-right tabular-nums">{money(j.labourCharge)}</td><td colSpan={2} /></tr>
                  <tr className="font-bold"><td colSpan={3} className="text-right">Estimated bill</td><td className="text-right tabular-nums">{money(partsTotal + j.labourCharge)}</td><td colSpan={2} /></tr>
                </tbody>
              </table>
            </TableWrap>
            {!locked && (
              <div className="border-t border-gray-100 p-4 no-print">
                <ActionForm action={addJobPart} className="grid gap-2 sm:grid-cols-[1fr_80px_110px_auto]">
                  <input type="hidden" name="jobCardId" value={j.id} />
                  <ProductPicker products={products} name="productId" placeholder="Search part / accessory…" />
                  <input name="qty" type="number" min="1" step="1" defaultValue={1} className="input" />
                  <input name="unitPrice" type="number" step="0.01" min="0" className="input" placeholder="Price (auto)" />
                  <Submit>Add</Submit>
                </ActionForm>
                <p className="mt-2 text-xs text-gray-500">Stock is reduced when the invoice is created.</p>
              </div>
            )}
          </Section>
        </div>

        <div className="space-y-5 no-print">
          <Section title="Job details">
            <dl className="mb-3 space-y-1 text-sm">
              <div className="flex justify-between"><dt className="text-gray-500">Technician</dt><dd>{j.technician?.name ?? "Unassigned"}</dd></div>
              <div className="flex justify-between"><dt className="text-gray-500">Estimate</dt><dd>{money(j.estimate)}</dd></div>
              {j.completedAt && <div className="flex justify-between"><dt className="text-gray-500">Completed</dt><dd>{fmtDateTime(j.completedAt)}</dd></div>}
              {j.deliveredAt && <div className="flex justify-between"><dt className="text-gray-500">Delivered</dt><dd>{fmtDateTime(j.deliveredAt)}</dd></div>}
            </dl>
            {!locked && (
              <Toggle label="Edit job">
                <ActionForm action={updateJobCard} className="space-y-3">
                  <input type="hidden" name="id" value={j.id} />
                  <label className="block"><span className="label">Work required</span><textarea name="complaint" rows={3} className="input" defaultValue={j.complaint} /></label>
                  <label className="block"><span className="label">Technician notes / diagnosis</span><textarea name="diagnosis" rows={3} className="input" defaultValue={j.diagnosis ?? ""} /></label>
                  <div className="grid grid-cols-2 gap-3">
                    <label><span className="label">Technician</span><select name="technicianId" className="input" defaultValue={j.technicianId ?? ""}><option value="">Unassigned</option>{techs.map((t) => <option key={t.id} value={t.id}>{t.name}</option>)}</select></label>
                    <label><span className="label">Odometer</span><input name="odometer" type="number" className="input" defaultValue={j.odometer ?? ""} /></label>
                    <label><span className="label">Labour ₹</span><input name="labourCharge" type="number" min="0" className="input" defaultValue={j.labourCharge} /></label>
                    <label><span className="label">Estimate ₹</span><input name="estimate" type="number" min="0" className="input" defaultValue={j.estimate} /></label>
                  </div>
                  <label className="block"><span className="label">Promised delivery</span><input name="promisedAt" type="datetime-local" className="input" defaultValue={toLocalInput(j.promisedAt)} /></label>
                  <Submit>Save</Submit>
                </ActionForm>
              </Toggle>
            )}
          </Section>
          {JOB_STATUSES.length > 0 && j.status === "COMPLETED" && !j.sale && (
            <div className="rounded-xl border border-emerald-200 bg-emerald-50 p-4 text-sm text-emerald-800">
              Work completed. Click <b>Create invoice</b> to bill the customer – the job will be marked Delivered automatically.
            </div>
          )}
        </div>
      </div>
    </>
  );
}
