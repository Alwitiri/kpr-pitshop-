import { db } from "@/lib/db";
import { requirePage } from "@/lib/auth";
import { money } from "@/lib/format";
import { FOLLOWUP_TYPES, PLACEHOLDERS, TRIGGERS } from "@/lib/workflows";
import { PageHeader, Section, TableWrap } from "@/components/ui";
import { ActionForm, Submit, Toggle } from "@/components/forms";
import { deleteWorkflowRule, runWorkflowsNow, saveWorkflowRule, toggleWorkflowRule } from "@/actions/followups";
import { cloudConfig } from "@/lib/wa-cloud";

export const metadata = { title: "Workflows" };

type Rule = {
  id?: number; name?: string; trigger?: string; delayDays?: number; followUpType?: string; title?: string;
  minAmount?: number; assignUserId?: number | null; active?: boolean; autoWhatsApp?: boolean;
};

function RuleForm({ r, staff, cloudOn }: { r?: Rule; staff: { id: number; name: string }[]; cloudOn: boolean }) {
  return (
    <ActionForm action={saveWorkflowRule} resetOnSuccess={!r?.id} className="space-y-3">
      {r?.id && <input type="hidden" name="id" value={r.id} />}
      <label className="block"><span className="label">Rule name *</span><input name="name" className="input" defaultValue={r?.name} placeholder="e.g. Helmet buyers – visor offer" required /></label>
      <label className="block">
        <span className="label">When</span>
        <select name="trigger" className="input" defaultValue={r?.trigger ?? "SALE_CREATED"}>
          {Object.entries(TRIGGERS).map(([k, t]) => <option key={k} value={k}>{t.label}</option>)}
        </select>
      </label>
      <div className="grid grid-cols-2 gap-2">
        <label><span className="label">Days</span><input name="delayDays" type="number" min="0" max="730" className="input" defaultValue={r?.delayDays ?? 0} /></label>
        <label>
          <span className="label">Task type</span>
          <select name="followUpType" className="input" defaultValue={r?.followUpType ?? "CALL"}>
            {Object.entries(FOLLOWUP_TYPES).map(([k, l]) => <option key={k} value={k}>{l}</option>)}
          </select>
        </label>
      </div>
      <p className="-mt-1 text-xs text-gray-500">Days: after the bill / job, or before a birthday / warranty end, or since the last visit (depends on “When”).</p>
      <label className="block">
        <span className="label">Task title *</span>
        <input name="title" className="input" defaultValue={r?.title} placeholder="Feedback call: {customer} – bill {invoice}" required />
        <span className="mt-1 block text-xs text-gray-500">You can use {PLACEHOLDERS.join(" ")}</span>
      </label>
      <div className="grid grid-cols-2 gap-2">
        <label><span className="label">Only if bill ≥ ₹</span><input name="minAmount" type="number" min="0" step="1" className="input" defaultValue={r?.minAmount ?? 0} /></label>
        <label>
          <span className="label">Give to</span>
          <select name="assignUserId" className="input" defaultValue={r?.assignUserId ?? ""}>
            <option value="">Anyone</option>
            {staff.map((u) => <option key={u.id} value={u.id}>{u.name}</option>)}
          </select>
        </label>
      </div>
      <label className="flex items-start gap-2 rounded-lg bg-emerald-50/60 p-2.5 text-sm">
        <input type="checkbox" name="autoWhatsApp" defaultChecked={r?.autoWhatsApp ?? false} className="mt-0.5 h-4 w-4" />
        <span>
          <b>Send WhatsApp automatically</b>
          <span className="block text-xs text-gray-600">
            {cloudOn
              ? "On the due date the matching message is sent by itself and the follow-up is marked done. If it fails, the follow-up stays open for a call."
              : "Needs automatic mode (WhatsApp settings → Sending method). Until then only the follow-up is made."}
          </span>
        </span>
      </label>
      <label className="flex items-center gap-2 text-sm"><input type="checkbox" name="active" defaultChecked={r?.active ?? true} className="h-4 w-4" /> Rule is on</label>
      <Submit>{r?.id ? "Save rule" : "Add rule"}</Submit>
    </ActionForm>
  );
}

export default async function WorkflowsPage() {
  await requirePage("settings");
  const cloudOn = (await cloudConfig()).on;
  const [rules, staff, counts] = await Promise.all([
    db.workflowRule.findMany({ orderBy: [{ active: "desc" }, { id: "asc" }] }),
    db.user.findMany({ where: { active: true }, select: { id: true, name: true }, orderBy: { name: "asc" } }),
    db.followUp.groupBy({ by: ["ruleId", "status"], where: { ruleId: { not: null } }, _count: true }),
  ]);
  const staffName = new Map(staff.map((u) => [u.id, u.name]));
  const stat = (id: number, status: string) => counts.find((c) => c.ruleId === id && c.status === status)?._count ?? 0;

  return (
    <>
      <PageHeader
        title="Workflows & automation"
        subtitle="Rules that create follow-up tasks automatically, so no customer is forgotten"
        back="/settings"
        actions={<ActionForm action={runWorkflowsNow}><Submit className="btn-outline">Check birthdays / warranties now</Submit></ActionForm>}
      />
      <div className="grid gap-5 xl:grid-cols-[1fr_380px]">
        <Section title={`Rules (${rules.filter((r) => r.active).length} on)`} pad={false}>
          <TableWrap>
            <table className="table">
              <thead><tr><th>Rule</th><th>When</th><th>Creates</th><th className="text-right">Open / done</th><th /></tr></thead>
              <tbody>
                {rules.map((r) => {
                  const t = TRIGGERS[r.trigger];
                  return (
                    <tr key={r.id} className={r.active ? "" : "opacity-50"}>
                      <td>
                        <div className="font-medium">{r.name}</div>
                        <div className="text-xs text-gray-500">{r.title}</div>
                      </td>
                      <td className="text-xs">
                        {t?.label ?? r.trigger}
                        <div className="text-gray-500">
                          {r.delayDays ? `${r.delayDays} ${(t?.delay ?? "days").replace(/^days/, r.delayDays === 1 ? "day" : "days")}`: t?.scheduled ? "on the day" : "same day"}
                          {r.minAmount > 0 && ` · bill ≥ ${money(r.minAmount)}`}
                        </div>
                      </td>
                      <td className="text-xs">
                        {FOLLOWUP_TYPES[r.followUpType] ?? r.followUpType}
                        {r.assignUserId && <div className="text-gray-500">for {staffName.get(r.assignUserId) ?? "—"}</div>}
                        {r.autoWhatsApp && <div className={`mt-1 badge ${cloudOn ? "bg-emerald-50 text-emerald-700" : "bg-gray-100 text-gray-500"}`} title={cloudOn ? "Sent automatically" : "Automatic mode is off"}>+ auto WhatsApp</div>}
                      </td>
                      <td className="text-right text-xs tabular-nums">{stat(r.id, "OPEN")} / {stat(r.id, "DONE")}</td>
                      <td className="min-w-48">
                        <div className="flex flex-wrap justify-end gap-1.5">
                          <form action={toggleWorkflowRule}><input type="hidden" name="id" value={r.id} /><button className={r.active ? "btn-outline btn-sm" : "btn-primary btn-sm"}>{r.active ? "Turn off" : "Turn on"}</button></form>
                          <Toggle label="Edit" className="btn-outline btn-sm"><div className="w-[min(85vw,380px)] text-left"><RuleForm r={r} staff={staff} cloudOn={cloudOn} /></div></Toggle>
                          <form action={deleteWorkflowRule}><input type="hidden" name="id" value={r.id} /><Submit className="btn-ghost btn-sm text-red-600" confirm={`Delete the rule “${r.name}”? Follow-ups it already made are kept.`}>Delete</Submit></form>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </TableWrap>
          {!rules.length && <p className="p-6 text-center text-sm text-gray-500">No rules yet – add one on the right.</p>}
        </Section>
        <div className="space-y-5">
          <Section title="Add a rule"><RuleForm staff={staff} cloudOn={cloudOn} /></Section>
          <Section title="Ideas">
            <ul className="list-disc space-y-1.5 pl-4 text-sm text-gray-600">
              <li>Bill ≥ ₹5,000 → “VIP thank-you call” after 1 day, given to the owner.</li>
              <li>Vehicle delivered → “Check the fitting is OK” after 7 days.</li>
              <li>Not visited for 60 days → “Monsoon offer call”.</li>
            </ul>
          </Section>
        </div>
      </div>
    </>
  );
}
