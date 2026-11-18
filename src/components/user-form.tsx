"use client";

import { ActionForm, Submit } from "./forms";
import { saveUser } from "@/actions/staff";
import { ROLES, ROLE_LABEL } from "@/lib/roles";

type U = { id?: number; name?: string; username?: string; role?: string; phone?: string | null; active?: boolean };

export function UserForm({ u }: { u?: U }) {
  return (
    <ActionForm action={saveUser} resetOnSuccess={!u?.id} className="space-y-3">
      {u?.id && <input type="hidden" name="id" value={u.id} />}
      <div className="grid gap-3 sm:grid-cols-2">
        <label><span className="label">Full name</span><input name="name" className="input" defaultValue={u?.name} required /></label>
        <label><span className="label">Username (for login)</span><input name="username" className="input lowercase" defaultValue={u?.username} required /></label>
        <label>
          <span className="label">Role</span>
          <select name="role" className="input" defaultValue={u?.role ?? "CASHIER"}>{ROLES.map((r) => <option key={r} value={r}>{ROLE_LABEL[r]}</option>)}</select>
        </label>
        <label><span className="label">Phone</span><input name="phone" className="input" defaultValue={u?.phone ?? ""} /></label>
        <label className="sm:col-span-2">
          <span className="label">{u?.id ? "New password (leave empty to keep)" : "Password"}</span>
          <input name="password" type="password" className="input" autoComplete="new-password" required={!u?.id} minLength={6} />
        </label>
      </div>
      {u?.id && <label className="inline-flex items-center gap-2 text-sm"><input type="checkbox" name="active" defaultChecked={u.active} className="h-4 w-4" /> Active (can log in)</label>}
      <div><Submit>{u?.id ? "Save" : "Add staff member"}</Submit></div>
    </ActionForm>
  );
}
