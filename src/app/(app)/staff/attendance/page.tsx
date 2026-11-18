import { db } from "@/lib/db";
import { requirePage } from "@/lib/auth";
import { ROLE_LABEL } from "@/lib/roles";
import { monthStart, ymd } from "@/lib/format";
import { PageHeader, Section, TableWrap } from "@/components/ui";
import { ActionForm, Submit } from "@/components/forms";
import { saveAttendance } from "@/actions/staff";

export const metadata = { title: "Attendance" };
const STATUSES = ["PRESENT", "ABSENT", "HALF_DAY", "LEAVE"];

export default async function AttendancePage({ searchParams }: { searchParams: Promise<{ date?: string }> }) {
  await requirePage("staff");
  const date = (await searchParams).date || ymd();
  const month = date.slice(0, 8) + "01";
  const [users, records, monthRecs] = await Promise.all([
    db.user.findMany({ where: { active: true }, orderBy: { name: "asc" } }),
    db.attendance.findMany({ where: { date } }),
    db.attendance.findMany({ where: { date: { gte: month, lte: month.slice(0, 8) + "31" } } }),
  ]);
  const rec = new Map(records.map((r) => [r.userId, r]));
  const summary = new Map<number, Record<string, number>>();
  for (const r of monthRecs) {
    const s = summary.get(r.userId) ?? {};
    s[r.status] = (s[r.status] ?? 0) + 1;
    summary.set(r.userId, s);
  }

  return (
    <>
      <PageHeader title="Attendance" back="/staff" />
      <form className="mb-4 flex items-end gap-2 no-print">
        <label><span className="label">Date</span><input type="date" name="date" defaultValue={date} className="input" /></label>
        <button className="btn-dark">Show</button>
      </form>
      <div className="grid gap-5 xl:grid-cols-[1fr_420px]">
        <Section title={`Mark attendance · ${date}`} pad={false}>
          <ActionForm action={saveAttendance}>
            <input type="hidden" name="date" value={date} />
            <TableWrap>
              <table className="table">
                <thead><tr><th>Staff</th>{STATUSES.map((s) => <th key={s} className="text-center">{s.replace("_", " ").toLowerCase()}</th>)}<th>Note</th></tr></thead>
                <tbody>
                  {users.map((u) => {
                    const cur = rec.get(u.id)?.status ?? "";
                    return (
                      <tr key={u.id}>
                        <td><div className="font-medium">{u.name}</div><div className="text-xs text-gray-500">{ROLE_LABEL[u.role]}</div></td>
                        {STATUSES.map((s) => (
                          <td key={s} className="text-center"><input type="radio" name={`st_${u.id}`} value={s} defaultChecked={cur === s} className="h-4 w-4" /></td>
                        ))}
                        <td><input name={`note_${u.id}`} className="input py-1" defaultValue={rec.get(u.id)?.note ?? ""} /></td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </TableWrap>
            <div className="p-4"><Submit>Save attendance</Submit></div>
          </ActionForm>
        </Section>
        <Section title={`Month summary · ${monthStart(new Date(`${date}T12:00:00+05:30`)).slice(0, 7)}`} pad={false}>
          <table className="table">
            <thead><tr><th>Staff</th><th className="text-right">Present</th><th className="text-right">Half</th><th className="text-right">Leave</th><th className="text-right">Absent</th></tr></thead>
            <tbody>
              {users.map((u) => {
                const s = summary.get(u.id) ?? {};
                return <tr key={u.id}><td>{u.name}</td><td className="text-right">{s.PRESENT ?? 0}</td><td className="text-right">{s.HALF_DAY ?? 0}</td><td className="text-right">{s.LEAVE ?? 0}</td><td className="text-right">{s.ABSENT ?? 0}</td></tr>;
              })}
            </tbody>
          </table>
        </Section>
      </div>
    </>
  );
}
