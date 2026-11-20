import Link from "next/link";
import { fmtDate, money } from "@/lib/format";
import { ActionForm, Submit, Toggle } from "./forms";
import { completeFollowUp, createFollowUp, reopenFollowUp, snoozeFollowUp } from "@/actions/followups";
import { Icon } from "./icons";

export const FOLLOWUP_LABEL: Record<string, string> = {
  CALL: "Call",
  FEEDBACK: "Feedback",
  SERVICE_DUE: "Service due",
  PAYMENT: "Payment",
  BIRTHDAY: "Birthday",
  WARRANTY: "Warranty",
  WIN_BACK: "Win back",
  OTHER: "Other",
};

const TYPE_CLS: Record<string, string> = {
  CALL: "bg-sky-50 text-sky-700",
  FEEDBACK: "bg-violet-50 text-violet-700",
  SERVICE_DUE: "bg-amber-50 text-amber-700",
  PAYMENT: "bg-red-50 text-red-700",
  BIRTHDAY: "bg-pink-50 text-pink-700",
  WARRANTY: "bg-emerald-50 text-emerald-700",
  WIN_BACK: "bg-orange-50 text-orange-700",
  OTHER: "bg-gray-100 text-gray-700",
};

export function FollowUpType({ type }: { type: string }) {
  return <span className={`badge ${TYPE_CLS[type] ?? TYPE_CLS.OTHER}`}>{FOLLOWUP_LABEL[type] ?? type}</span>;
}

export type FollowUpItem = {
  id: number;
  type: string;
  title: string;
  notes: string | null;
  dueDate: Date;
  status: string;
  outcome: string | null;
  doneAt: Date | null;
  customer: { id: number; name: string; phone: string | null } | null;
  assignedTo: { name: string } | null;
  rule: { name: string } | null;
  due?: number; // current outstanding (payment follow-ups)
};

/** Days from today (IST): negative = overdue. */
function daysFromToday(d: Date, today: string) {
  const a = new Date(`${today}T12:00:00+05:30`).getTime();
  return Math.round((d.getTime() - a) / 864e5);
}

function DueLabel({ d, today }: { d: Date; today: string }) {
  const n = daysFromToday(d, today);
  if (n < 0) return <span className="font-semibold text-red-600">{-n === 1 ? "Yesterday" : `${-n} days overdue`}</span>;
  if (n === 0) return <span className="font-semibold text-amber-700">Today</span>;
  if (n === 1) return <span className="text-gray-700">Tomorrow</span>;
  return <span className="text-gray-600">{fmtDate(d)}</span>;
}

export function FollowUpRows({ items, today, showCustomer = true }: { items: FollowUpItem[]; today: string; showCustomer?: boolean }) {
  return (
    <ul className="divide-y divide-gray-100">
      {items.map((f) => (
        <li key={f.id} className={`flex flex-wrap items-start gap-3 px-4 py-3 sm:px-5 ${f.status !== "OPEN" ? "opacity-60" : ""}`}>
          <div className="w-28 shrink-0 text-xs">
            {f.status === "OPEN" ? <DueLabel d={f.dueDate} today={today} /> : <span className="text-gray-500">{f.status === "DONE" ? "Done" : "Skipped"} {fmtDate(f.doneAt)}</span>}
            <div className="mt-1"><FollowUpType type={f.type} /></div>
          </div>
          <div className="min-w-0 flex-1">
            <div className="text-sm font-medium text-gray-900">{f.title}</div>
            <div className="mt-0.5 flex flex-wrap gap-x-3 text-xs text-gray-500">
              {showCustomer && f.customer && (
                <Link className="link" href={`/customers/${f.customer.id}`}>{f.customer.name}</Link>
              )}
              {f.customer?.phone && <a className="inline-flex items-center gap-1 font-medium text-link hover:underline" href={`tel:${f.customer.phone}`}><Icon name="phone" className="h-3 w-3" />{f.customer.phone}</a>}
              {f.due != null && f.due > 0.5 && <span className="font-semibold text-amber-700">Due now {money(f.due)}</span>}
              {f.assignedTo && <span>For {f.assignedTo.name}</span>}
              {f.rule && <span className="inline-flex items-center gap-1" title="Created automatically by a workflow rule"><Icon name="gear" className="h-3 w-3" />{f.rule.name}</span>}
            </div>
            {f.notes && <div className="mt-1 text-xs text-gray-600">{f.notes}</div>}
            {f.outcome && <div className="mt-1.5 flex items-start gap-1.5 rounded-md bg-gray-50 px-2 py-1 text-xs text-gray-800"><Icon name="check" className="mt-px h-3 w-3 text-emerald-600" />{f.outcome}</div>}
          </div>
          <div className="flex flex-wrap items-start gap-1.5">
            {f.status === "OPEN" ? (
              <>
                <Toggle label="Done" className="btn-primary btn-sm">
                  <ActionForm action={completeFollowUp} className="w-72 space-y-2">
                    <input type="hidden" name="id" value={f.id} />
                    <textarea name="outcome" rows={2} className="input text-sm" placeholder="What happened? e.g. Will come Saturday" />
                    <label className="flex items-center gap-2 text-xs text-gray-600">
                      Follow up again in
                      <select name="nextInDays" className="input w-28 py-1 text-xs" defaultValue="0">
                        <option value="0">No need</option>
                        <option value="1">1 day</option>
                        <option value="3">3 days</option>
                        <option value="7">1 week</option>
                        <option value="30">1 month</option>
                        <option value="90">3 months</option>
                      </select>
                    </label>
                    <div className="flex gap-2">
                      <Submit className="btn-primary btn-sm">Save</Submit>
                      <Submit className="btn-ghost btn-sm" name="_skip" value="1">Skip – not needed</Submit>
                    </div>
                  </ActionForm>
                </Toggle>
                <form action={snoozeFollowUp} className="flex">
                  <input type="hidden" name="id" value={f.id} />
                  <select name="days" className="input rounded-r-none py-1 text-xs" defaultValue="1" aria-label="Snooze for">
                    <option value="1">+1 day</option>
                    <option value="3">+3 days</option>
                    <option value="7">+1 week</option>
                  </select>
                  <button className="btn-outline btn-sm rounded-l-none border-l-0">Later</button>
                </form>
              </>
            ) : (
              <form action={reopenFollowUp}>
                <input type="hidden" name="id" value={f.id} />
                <button className="btn-ghost btn-sm">Reopen</button>
              </form>
            )}
          </div>
        </li>
      ))}
    </ul>
  );
}

export function NewFollowUpForm({
  customerId,
  staff,
  today,
}: {
  customerId?: number;
  staff: { id: number; name: string }[];
  today: string;
}) {
  return (
    <ActionForm action={createFollowUp} resetOnSuccess className="grid gap-2 sm:grid-cols-2">
      {customerId ? <input type="hidden" name="customerId" value={customerId} /> : (
        <input name="phone" className="input sm:col-span-2" placeholder="Customer mobile (optional)" inputMode="tel" />
      )}
      <input name="title" className="input sm:col-span-2" placeholder="What to do * e.g. Tell him the seat cover arrived" required />
      <select name="type" className="input" defaultValue="CALL">
        {Object.entries(FOLLOWUP_LABEL).map(([k, l]) => <option key={k} value={k}>{l}</option>)}
      </select>
      <input name="dueDate" type="date" className="input" defaultValue={today} />
      <select name="assignedToId" className="input sm:col-span-2" defaultValue="">
        <option value="">Anyone</option>
        {staff.map((u) => <option key={u.id} value={u.id}>{u.name}</option>)}
      </select>
      <textarea name="notes" rows={2} className="input sm:col-span-2" placeholder="Notes (optional)" />
      <Submit className="btn-primary sm:col-span-2">Add follow-up</Submit>
    </ActionForm>
  );
}
