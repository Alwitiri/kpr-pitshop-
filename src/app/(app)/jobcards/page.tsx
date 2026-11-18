import Link from "next/link";
import { db } from "@/lib/db";
import { requirePage } from "@/lib/auth";
import { fmtDate, fmtDateTime, money } from "@/lib/format";
import { label } from "@/lib/calc";
import { Badge, Empty, PageHeader, TableWrap } from "@/components/ui";

export const metadata = { title: "Job cards" };
const BOARD = ["RECEIVED", "INSPECTION", "IN_PROGRESS", "COMPLETED"];

export default async function JobCardsPage({ searchParams }: { searchParams: Promise<{ view?: string; q?: string }> }) {
  const s = await requirePage("jobcards");
  const sp = await searchParams;
  const mine = s.role === "TECHNICIAN";
  const open = await db.jobCard.findMany({
    where: { status: { in: BOARD }, ...(mine ? { technicianId: s.uid } : {}) },
    include: { customer: { select: { name: true, phone: true } }, vehicle: true, technician: { select: { name: true } }, parts: true },
    orderBy: { receivedAt: "asc" },
  });
  const history = sp.view === "all"
    ? await db.jobCard.findMany({
        where: { status: { in: ["DELIVERED", "CANCELLED"] }, ...(sp.q ? { OR: [{ number: { contains: sp.q } }, { customer: { name: { contains: sp.q } } }, { vehicle: { regNo: { contains: sp.q.toUpperCase() } } }] } : {}) },
        include: { customer: { select: { name: true } }, vehicle: true, sale: { select: { id: true, invoiceNo: true, total: true } } },
        orderBy: { receivedAt: "desc" },
        take: 200,
      })
    : [];

  return (
    <>
      <PageHeader
        title="Job cards"
        subtitle={mine ? "Jobs assigned to you" : "Fitting, installation and service jobs"}
        actions={
          <>
            <Link href={sp.view === "all" ? "/jobcards" : "/jobcards?view=all"} className="btn-outline">{sp.view === "all" ? "Board view" : "Delivered history"}</Link>
            <Link href="/jobcards/new" className="btn-primary">+ New job card</Link>
          </>
        }
      />
      {sp.view !== "all" ? (
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
          {BOARD.map((st) => {
            const jobs = open.filter((j) => j.status === st);
            return (
              <div key={st} className="rounded-xl bg-gray-100 p-3">
                <div className="mb-2 flex items-center justify-between px-1">
                  <span className="text-sm font-semibold">{label(st)}</span>
                  <span className="badge bg-white text-gray-700">{jobs.length}</span>
                </div>
                <div className="space-y-2">
                  {jobs.map((j) => {
                    const late = j.promisedAt && j.promisedAt < new Date();
                    const partsTotal = j.parts.reduce((a, p) => a + p.qty * p.unitPrice, 0);
                    return (
                      <Link key={j.id} href={`/jobcards/${j.id}`} className="card block p-3 transition hover:shadow-md">
                        <div className="flex items-center justify-between">
                          <span className="font-mono text-xs text-gray-500">{j.number}</span>
                          {late && <span className="badge bg-red-50 text-red-700">Overdue</span>}
                        </div>
                        <div className="mt-1 font-semibold">{j.vehicle ? `${j.vehicle.make} ${j.vehicle.model ?? ""}` : j.customer.name}</div>
                        {j.vehicle?.regNo && <div className="font-mono text-xs">{j.vehicle.regNo}</div>}
                        <div className="mt-1 line-clamp-2 text-sm text-gray-600">{j.complaint}</div>
                        <div className="mt-2 flex justify-between text-xs text-gray-500">
                          <span>{j.customer.name}</span>
                          <span>{j.technician?.name ?? "Unassigned"}</span>
                        </div>
                        <div className="mt-1 flex justify-between text-xs text-gray-500">
                          <span>In: {fmtDateTime(j.receivedAt)}</span>
                          <span>{money(partsTotal + j.labourCharge)}</span>
                        </div>
                      </Link>
                    );
                  })}
                  {!jobs.length && <p className="py-4 text-center text-xs text-gray-400">No jobs</p>}
                </div>
              </div>
            );
          })}
        </div>
      ) : (
        <>
          <form className="mb-4 flex gap-2 no-print"><input type="hidden" name="view" value="all" /><input name="q" defaultValue={sp.q} className="input max-w-sm" placeholder="Job no., customer or vehicle no." /><button className="btn-dark">Search</button></form>
          <div className="card">
            <TableWrap>
              <table className="table">
                <thead><tr><th>Job</th><th>Received</th><th>Customer</th><th>Vehicle</th><th>Status</th><th>Invoice</th></tr></thead>
                <tbody>
                  {history.map((j) => (
                    <tr key={j.id}>
                      <td><Link className="link font-mono text-xs" href={`/jobcards/${j.id}`}>{j.number}</Link></td>
                      <td className="text-xs">{fmtDate(j.receivedAt)}</td>
                      <td className="text-sm">{j.customer.name}</td>
                      <td className="text-xs">{j.vehicle ? `${j.vehicle.make} ${j.vehicle.model ?? ""} ${j.vehicle.regNo ?? ""}` : ""}</td>
                      <td><Badge status={j.status} /></td>
                      <td className="text-xs">{j.sale ? <Link className="link" href={`/sales/${j.sale.id}`}>{j.sale.invoiceNo} · {money(j.sale.total)}</Link> : "—"}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </TableWrap>
            {!history.length && <Empty>No delivered jobs found.</Empty>}
          </div>
        </>
      )}
    </>
  );
}
