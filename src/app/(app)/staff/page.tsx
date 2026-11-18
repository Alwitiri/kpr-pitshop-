import Link from "next/link";
import { db } from "@/lib/db";
import { requirePage } from "@/lib/auth";
import { ROLE_LABEL } from "@/lib/roles";
import { dayRange, fmtDate, money, monthStart, ymd } from "@/lib/format";
import { Badge, PageHeader, Section, TableWrap } from "@/components/ui";
import { Toggle } from "@/components/forms";
import { UserForm } from "@/components/user-form";

export const metadata = { title: "Staff" };

const PERMS: [string, string][] = [
  ["Owner", "Everything, including staff, settings, profit and cancelling bills"],
  ["Manager", "Billing, stock, purchases, customers, expenses, reports, cancel bills"],
  ["Cashier", "POS billing, sales, customers, job cards"],
  ["Inventory Staff", "Products, stock, purchases, suppliers"],
  ["Technician", "Job cards assigned to them"],
];

export default async function StaffPage() {
  await requirePage("staff");
  const today = ymd();
  const [users, todaySales, monthSales, att] = await Promise.all([
    db.user.findMany({ orderBy: [{ active: "desc" }, { name: "asc" }] }),
    db.sale.groupBy({ by: ["userId"], where: { date: dayRange(today), status: { not: "CANCELLED" } }, _sum: { total: true }, _count: true }),
    db.sale.groupBy({ by: ["userId"], where: { date: dayRange(monthStart(), today), status: { not: "CANCELLED" } }, _sum: { total: true }, _count: true }),
    db.attendance.findMany({ where: { date: today } }),
  ]);
  const t = new Map(todaySales.map((r) => [r.userId, r]));
  const m = new Map(monthSales.map((r) => [r.userId, r]));
  const a = new Map(att.map((r) => [r.userId, r.status]));

  return (
    <>
      <PageHeader
        title="Staff"
        subtitle="Logins, roles, attendance and performance"
        actions={<><Link href="/staff/activity" className="btn-outline">Activity log</Link><Link href="/staff/attendance" className="btn-primary">Attendance</Link></>}
      />
      <div className="grid gap-5 xl:grid-cols-[1fr_380px]">
        <div className="card">
          <TableWrap>
            <table className="table">
              <thead><tr><th>Name</th><th>Username</th><th>Role</th><th>Today</th><th className="text-right">Sales today</th><th className="text-right">Sales this month</th><th>Status</th><th /></tr></thead>
              <tbody>
                {users.map((u) => (
                  <tr key={u.id} className={u.active ? "" : "opacity-50"}>
                    <td><div className="font-medium">{u.name}</div><div className="text-xs text-gray-500">{u.phone} · since {fmtDate(u.createdAt)}</div></td>
                    <td className="font-mono text-xs">{u.username}</td>
                    <td className="text-sm">{ROLE_LABEL[u.role]}</td>
                    <td>{a.get(u.id) ? <Badge status={a.get(u.id)!} /> : <span className="text-xs text-gray-400">Not marked</span>}</td>
                    <td className="text-right tabular-nums">{money(t.get(u.id)?._sum.total)} <span className="text-xs text-gray-400">({t.get(u.id)?._count ?? 0})</span></td>
                    <td className="text-right tabular-nums">{money(m.get(u.id)?._sum.total)} <span className="text-xs text-gray-400">({m.get(u.id)?._count ?? 0})</span></td>
                    <td><Badge status={u.active ? "ACTIVE" : "INACTIVE"} /></td>
                    <td className="min-w-28"><Toggle label="Edit" className="btn-outline btn-sm"><div className="w-[min(90vw,520px)]"><UserForm u={u} /></div></Toggle></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </TableWrap>
        </div>
        <div className="space-y-5">
          <Section title="Add staff member"><UserForm /></Section>
          <Section title="What each role can do">
            <ul className="space-y-2 text-sm">{PERMS.map(([r, d]) => <li key={r}><b>{r}:</b> <span className="text-gray-600">{d}</span></li>)}</ul>
          </Section>
        </div>
      </div>
    </>
  );
}
