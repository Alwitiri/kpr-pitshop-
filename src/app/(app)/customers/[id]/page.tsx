import Link from "next/link";
import { notFound } from "next/navigation";
import { db } from "@/lib/db";
import { requirePage } from "@/lib/auth";
import { fmtDate, fmtDateTime, money, qty, round2 } from "@/lib/format";
import { Badge, PageHeader, Section, Stat, TableWrap } from "@/components/ui";
import { ActionForm, Submit, Toggle } from "@/components/forms";
import { CustomerForm } from "@/components/customer-form";
import { PaymentForm } from "@/components/payment-form";
import { addVehicle, deleteVehicle } from "@/actions/customers";
import { receiveCustomerPayment } from "@/actions/sales";
import { addInteraction, deleteInteraction } from "@/actions/followups";
import { can } from "@/lib/roles";
import { ymd } from "@/lib/format";
import { SEGMENTS, segmentOf } from "@/lib/crm";
import { FollowUpRows, NewFollowUpForm } from "@/components/followups";
import { Icon } from "@/components/icons";
import { WhatsAppButton, WhatsAppMenu } from "@/components/whatsapp-button";

const INTERACTION_LABEL: Record<string, string> = { CALL: "Call", VISIT: "Visit", WHATSAPP: "WhatsApp", COMPLAINT: "Complaint", NOTE: "Note" };
const INTERACTION_ICON: Record<string, [string, string]> = {
  CALL: ["phone", "bg-sky-50 text-sky-700"], VISIT: ["store", "bg-emerald-50 text-emerald-700"], WHATSAPP: ["chat", "bg-green-50 text-green-700"],
  COMPLAINT: ["alert", "bg-red-50 text-red-700"], NOTE: ["note", "bg-gray-100 text-gray-700"],
};

export async function generateMetadata({ params }: { params: Promise<{ id: string }> }) {
  const r = await db.customer.findUnique({ where: { id: Number((await params).id) || 0 }, select: { name: true } });
  return { title: r?.name ?? "Customer" };
}

export default async function CustomerPage({ params }: { params: Promise<{ id: string }> }) {
  const session = await requirePage("customers");
  const id = Number((await params).id);
  const showFollowUps = can(session.role, "followups");
  const c = await db.customer.findUnique({
    where: { id },
    include: {
      vehicles: true,
      sales: { orderBy: { date: "desc" }, include: { items: true, vehicle: true } },
      payments: { where: { saleId: null }, orderBy: { date: "desc" } },
      jobCards: { orderBy: { receivedAt: "desc" }, include: { vehicle: true } },
      interactions: { orderBy: { createdAt: "desc" }, take: 50 },
      followUps: {
        orderBy: [{ status: "asc" }, { dueDate: "asc" }],
        take: 30,
        include: { customer: { select: { id: true, name: true, phone: true } }, assignedTo: { select: { name: true } }, rule: { select: { name: true } } },
      },
    },
  });
  if (!c) notFound();
  const staff = showFollowUps ? await db.user.findMany({ where: { active: true }, select: { id: true, name: true }, orderBy: { name: "asc" } }) : [];
  const today = ymd();
  const valid = c.sales.filter((s) => s.status !== "CANCELLED");
  const spent = valid.reduce((a, s) => a + s.total - s.returnedAmount, 0);
  const onAccount = c.payments.reduce((a, p) => a + p.amount, 0);
  const due = round2(c.openingBalance + valid.reduce((a, s) => a + s.total - s.returnedAmount - s.paidAmount, 0) - onAccount);
  const now = new Date();
  const warranties = valid.flatMap((s) => s.items.filter((i) => i.warrantyUntil && i.warrantyUntil > now && i.qty > i.returnedQty).map((i) => ({ ...i, invoiceNo: s.invoiceNo, saleId: s.id, date: s.date })));

  // Favourite products
  const fav = new Map<string, number>();
  for (const s of valid) for (const i of s.items) fav.set(i.name, (fav.get(i.name) ?? 0) + i.qty);
  const topItems = [...fav.entries()].sort((a, b) => b[1] - a[1]).slice(0, 5);
  const segment = SEGMENTS[segmentOf({ visits: valid.length, spent, first: valid.at(-1)?.date ?? null, last: valid[0]?.date ?? null })];
  const openFollowUps = c.followUps.filter((f) => f.status === "OPEN");
  const pastFollowUps = c.followUps.filter((f) => f.status !== "OPEN").slice(0, 5);

  return (
    <>
      <PageHeader
        title={c.name}
        subtitle={<>{c.phone} {c.whatsappOptIn ? <span className="badge ml-1 bg-emerald-50 text-emerald-700">WhatsApp opted in {c.optInAt && `· ${fmtDate(c.optInAt)}`}</span> : <span className="badge ml-1 bg-gray-100 text-gray-500">No WhatsApp consent</span>} <span className={`badge ml-1 ${segment.cls}`} title={`${segment.rule}. ${segment.action}`}>{segment.label}</span></>}
        back="/customers"
        actions={<><Link className="btn-outline" href={`/jobcards/new?customer=${c.id}`}>+ Job card</Link><Link className="btn-primary" href="/pos">New bill</Link></>}
      />
      <div className="mb-5 grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Stat label="Total spent" value={money(spent)} />
        <Stat label="Visits" value={valid.length} hint={valid[0] ? `Last: ${fmtDate(valid[0].date)}` : "No purchases yet"} />
        <Stat label="Average bill" value={money(valid.length ? spent / valid.length : 0)} />
        <Stat label="Outstanding" value={money(due)} tone={due > 0.5 ? "warn" : "good"} />
      </div>
      <div className="grid gap-5 xl:grid-cols-[1fr_400px]">
        <div className="space-y-5">
          {showFollowUps && (
            <Section title={`Follow-ups${openFollowUps.length ? ` · ${openFollowUps.length} open` : ""}`} pad={false}
              actions={<Toggle label="+ Add" className="btn-outline btn-sm"><div className="w-[min(85vw,420px)]"><NewFollowUpForm customerId={c.id} staff={staff} today={today} /></div></Toggle>}>
              <FollowUpRows items={[...openFollowUps, ...pastFollowUps]} today={today} showCustomer={false} />
              {!c.followUps.length && <p className="p-4 text-sm text-gray-500">No follow-ups yet.</p>}
            </Section>
          )}
          <Section title="Contact history" pad={false}>
            <div className="border-b border-gray-100 p-4 sm:px-5">
              <ActionForm action={addInteraction} resetOnSuccess className="flex flex-wrap gap-2">
                <input type="hidden" name="customerId" value={c.id} />
                <select name="type" className="input w-36" defaultValue="CALL">
                  {Object.entries(INTERACTION_LABEL).map(([k, l]) => <option key={k} value={k}>{l}</option>)}
                </select>
                <input name="note" className="input min-w-48 flex-1" placeholder="e.g. Asked for Classic 350 crash guard price" required />
                <Submit className="btn-dark">Save</Submit>
              </ActionForm>
            </div>
            <ul className="max-h-80 divide-y divide-gray-100 overflow-y-auto">
              {c.interactions.map((i) => (
                <li key={i.id} className="flex items-start gap-3 px-4 py-2.5 sm:px-5">
                  <span className={`inline-flex w-28 shrink-0 items-center gap-1.5 rounded-md px-2 py-1 text-xs font-medium ${(INTERACTION_ICON[i.type] ?? INTERACTION_ICON.NOTE)[1]}`}><Icon name={(INTERACTION_ICON[i.type] ?? INTERACTION_ICON.NOTE)[0]} className="h-3.5 w-3.5" />{INTERACTION_LABEL[i.type] ?? i.type}</span>
                  <span className="flex-1 text-sm text-gray-800">{i.note}</span>
                  <span className="shrink-0 text-right text-[11px] text-gray-400">{fmtDateTime(i.createdAt)}{i.userName && <div>{i.userName}</div>}</span>
                  {(session.role === "OWNER" || i.userId === session.uid) && (
                    <form action={deleteInteraction}><input type="hidden" name="id" value={i.id} /><button className="grid h-8 w-8 place-items-center rounded-md text-gray-400 hover:bg-red-50 hover:text-red-600" aria-label="Delete note" title="Delete note"><Icon name="x" className="h-3.5 w-3.5" /></button></form>
                  )}
                </li>
              ))}
              {!c.interactions.length && <li className="p-4 text-sm text-gray-500">No calls or notes yet. Log every call, visit or complaint here.</li>}
            </ul>
          </Section>
          <Section title="Purchase history" pad={false}>
            <TableWrap>
              <table className="table">
                <thead><tr><th>Invoice</th><th>Date</th><th>Vehicle</th><th>Items</th><th className="text-right">Total</th><th>Status</th></tr></thead>
                <tbody>
                  {c.sales.map((s) => (
                    <tr key={s.id}>
                      <td><Link className="link font-mono text-xs" href={`/sales/${s.id}`}>{s.invoiceNo}</Link></td>
                      <td className="text-xs">{fmtDate(s.date)}</td>
                      <td className="text-xs">{s.vehicle ? `${s.vehicle.make} ${s.vehicle.model ?? ""}` : "—"}</td>
                      <td className="max-w-72 text-xs text-gray-600">{s.items.map((i) => `${i.name}${i.qty > 1 ? ` ×${qty(i.qty)}` : ""}`).join(", ")}</td>
                      <td className="text-right tabular-nums">{money(s.total)}</td>
                      <td><Badge status={s.status} /></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </TableWrap>
            {!c.sales.length && <p className="p-4 text-sm text-gray-500">No purchases yet.</p>}
          </Section>
          {c.jobCards.length > 0 && (
            <Section title="Service / installation history" pad={false}>
              <table className="table">
                <tbody>
                  {c.jobCards.map((j) => (
                    <tr key={j.id}>
                      <td><Link className="link font-mono text-xs" href={`/jobcards/${j.id}`}>{j.number}</Link></td>
                      <td className="text-xs">{fmtDate(j.receivedAt)}</td>
                      <td className="text-xs">{j.vehicle ? `${j.vehicle.make} ${j.vehicle.model ?? ""}` : ""}</td>
                      <td className="text-sm">{j.complaint}</td>
                      <td><Badge status={j.status} /></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </Section>
          )}
          {warranties.length > 0 && (
            <Section title="Active warranties" pad={false}>
              <table className="table">
                <tbody>
                  {warranties.map((w) => (
                    <tr key={w.id}>
                      <td className="text-sm">{w.name}</td>
                      <td className="text-xs"><Link className="link" href={`/sales/${w.saleId}`}>{w.invoiceNo}</Link> · bought {fmtDate(w.date)}</td>
                      <td className="text-right text-sm">till <b>{fmtDate(w.warrantyUntil)}</b></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </Section>
          )}
        </div>
        <div className="space-y-5">
          {c.phone && (
            <Section title="WhatsApp" actions={c.whatsappOptIn ? <span className="badge bg-emerald-50 text-emerald-700">Offers allowed</span> : <span className="badge bg-gray-100 text-gray-600">Service messages only</span>}>
              <WhatsAppMenu customerId={c.id} />
              <p className="mt-2 text-xs text-gray-500">Opens WhatsApp with the message ready – check it and press Send.</p>
            </Section>
          )}
          {due > 0.5 && (
            <Section title={`Receive dues · ${money(due)}`} actions={c.phone ? <WhatsAppButton kind="PAYMENT_DUE" customerId={c.id} label="Remind" className="btn-outline btn-sm" /> : undefined}>
              <PaymentForm action={receiveCustomerPayment} hidden={{ customerId: c.id }} defaultAmount={due} submitLabel="Receive payment" />
            </Section>
          )}
          <Section title="Vehicles">
            <ul className="mb-3 space-y-2">
              {c.vehicles.map((v) => (
                <li key={v.id} className="flex items-center justify-between rounded-lg bg-gray-50 px-3 py-2 text-sm">
                  <span>
                    <b>{v.make} {v.model}</b> <span className="text-xs text-gray-500">{v.type === "CAR" ? "Car" : "Bike"}{v.year ? ` · ${v.year}` : ""}</span>
                    {v.regNo && <div className="font-mono text-xs">{v.regNo}</div>}
                  </span>
                  <span className="flex gap-2">
                    <Link className="text-xs font-medium text-link hover:underline" href={`/products?make=${encodeURIComponent(v.make)}&model=${encodeURIComponent(v.model ?? "")}`}>Fitting products</Link>
                    <form action={deleteVehicle}><input type="hidden" name="id" value={v.id} /><button className="text-xs text-gray-400 hover:text-red-600">Remove</button></form>
                  </span>
                </li>
              ))}
            </ul>
            <Toggle label="+ Add vehicle" className="btn-outline btn-sm">
              <ActionForm action={addVehicle} resetOnSuccess className="grid grid-cols-2 gap-2">
                <input type="hidden" name="customerId" value={c.id} />
                <select name="type" className="input"><option value="BIKE">Bike</option><option value="CAR">Car</option></select>
                <input name="make" className="input" placeholder="Make *" required />
                <input name="model" className="input" placeholder="Model" />
                <input name="regNo" className="input uppercase" placeholder="Reg. no." />
                <input name="year" type="number" className="input" placeholder="Year" />
                <input name="color" className="input" placeholder="Colour" />
                <Submit className="btn-primary col-span-2">Add vehicle</Submit>
              </ActionForm>
            </Toggle>
          </Section>
          {topItems.length > 0 && (
            <Section title="Frequently bought">
              <ul className="space-y-1 text-sm">{topItems.map(([n, q]) => <li key={n} className="flex justify-between"><span className="truncate">{n}</span><span className="tabular-nums text-gray-500">×{qty(q)}</span></li>)}</ul>
            </Section>
          )}
          <Section title="Profile">
            <div className="mb-3 space-y-1 text-sm text-gray-600">
              {c.address && <div>{c.address}</div>}
              {c.email && <div>{c.email}</div>}
              {c.birthday && <div>Birthday: {c.birthday}</div>}
              {c.tags && <div>Tags: {c.tags}</div>}
              {c.notes && <div>Notes: {c.notes}</div>}
              <div className="text-xs">Customer since {fmtDate(c.createdAt)}</div>
            </div>
            <Toggle label="Edit profile"><CustomerForm c={c} /></Toggle>
          </Section>
          {c.payments.length > 0 && (
            <Section title="On-account payments" pad={false}>
              <table className="table"><tbody>{c.payments.map((p) => <tr key={p.id}><td className="text-xs">{fmtDateTime(p.date)}</td><td className="text-xs">{p.method}</td><td className="text-right tabular-nums">{money(p.amount)}</td></tr>)}</tbody></table>
            </Section>
          )}
        </div>
      </div>
    </>
  );
}
