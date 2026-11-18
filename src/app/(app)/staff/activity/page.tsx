import type { Prisma } from "@prisma/client";
import { db } from "@/lib/db";
import { requirePage } from "@/lib/auth";
import { dayRange, fmtDateTime } from "@/lib/format";
import { label } from "@/lib/calc";
import { FilterBar, PageHeader, Pager, TableWrap, qs } from "@/components/ui";

export const metadata = { title: "Activity log" };
const PER = 100;

export default async function ActivityPage({ searchParams }: { searchParams: Promise<Record<string, string | undefined>> }) {
  await requirePage("staff");
  const sp = await searchParams;
  const page = Math.max(1, Number(sp.page) || 1);
  const where: Prisma.AuditLogWhereInput = {};
  if (sp.user) where.userId = Number(sp.user);
  if (sp.action) where.action = { contains: sp.action.toUpperCase() };
  if (sp.from || sp.to) where.createdAt = dayRange(sp.from || "2000-01-01", sp.to || "2999-12-31");
  const [total, rows, users] = await Promise.all([
    db.auditLog.count({ where }),
    db.auditLog.findMany({ where, include: { user: { select: { name: true } } }, orderBy: { createdAt: "desc" }, skip: (page - 1) * PER, take: PER }),
    db.user.findMany({ select: { id: true, name: true } }),
  ]);
  return (
    <>
      <PageHeader title="Activity log" subtitle="Who did what and when – logins, bills, stock changes, cancellations" back="/staff" />
      <FilterBar>
        <label><span className="label">Staff</span><select name="user" defaultValue={sp.user ?? ""} className="input"><option value="">All</option>{users.map((u) => <option key={u.id} value={u.id}>{u.name}</option>)}</select></label>
        <label><span className="label">Action contains</span><input name="action" defaultValue={sp.action} className="input" placeholder="cancel, stock, login…" /></label>
        <label><span className="label">From</span><input type="date" name="from" defaultValue={sp.from} className="input" /></label>
        <label><span className="label">To</span><input type="date" name="to" defaultValue={sp.to} className="input" /></label>
      </FilterBar>
      <div className="card">
        <TableWrap>
          <table className="table">
            <thead><tr><th>When</th><th>Staff</th><th>Action</th><th>Record</th><th>Details</th></tr></thead>
            <tbody>
              {rows.map((r) => (
                <tr key={r.id}>
                  <td className="text-xs whitespace-nowrap">{fmtDateTime(r.createdAt)}</td>
                  <td className="text-sm">{r.user?.name ?? "—"}</td>
                  <td className={`text-xs font-medium ${/CANCEL|DELETE|FAILED/.test(r.action) ? "text-red-600" : ""}`}>{label(r.action)}</td>
                  <td className="text-xs">{r.entity}{r.entityId ? ` #${r.entityId}` : ""}</td>
                  <td className="max-w-md truncate text-xs text-gray-600">{r.details}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </TableWrap>
        <Pager page={page} pages={Math.ceil(total / PER)} base={`/staff/activity${qs(sp)}`} />
      </div>
    </>
  );
}
