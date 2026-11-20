import { redirect } from "next/navigation";
import { requirePage } from "@/lib/auth";
import { DEFAULT_PERMS, PERM_GROUPS, ROLE_LABEL, permsFor } from "@/lib/roles";
import { PageHeader, Section, TableWrap } from "@/components/ui";
import { ActionForm, Submit } from "@/components/forms";
import { savePermissions } from "@/actions/permissions";

export const metadata = { title: "Permissions" };

export default async function PermissionsPage() {
  const s = await requirePage("staff");
  if (s.role !== "OWNER") redirect("/staff");
  const roles = Object.keys(DEFAULT_PERMS);
  const current = Object.fromEntries(roles.map((r) => [r, new Set(permsFor(r))]));

  return (
    <>
      <PageHeader
        title="Permissions"
        subtitle="Choose what each role can see and do. The owner always has full access."
        back="/staff"
      />
      <ActionForm action={savePermissions} className="space-y-5">
        {PERM_GROUPS.map((g) => (
          <Section key={g.title} title={g.title} pad={false}>
            <TableWrap>
              <table className="table">
                <thead>
                  <tr>
                    <th>Permission</th>
                    <th className="text-center">Owner</th>
                    {roles.map((r) => <th key={r} className="text-center">{ROLE_LABEL[r]}</th>)}
                  </tr>
                </thead>
                <tbody>
                  {g.perms.map(([p, label, hint]) => (
                    <tr key={p}>
                      <td>
                        <div className="font-medium">{label}</div>
                        <div className="text-xs text-gray-500">{hint}</div>
                      </td>
                      <td className="text-center"><input type="checkbox" checked disabled className="h-4 w-4" aria-label={`Owner – ${label}`} /></td>
                      {roles.map((r) => (
                        <td key={r} className="text-center">
                          <input
                            type="checkbox"
                            name={`${r}:${p}`}
                            defaultChecked={current[r].has(p)}
                            disabled={p === "dashboard"}
                            className="h-4 w-4 accent-brand-600"
                            aria-label={`${ROLE_LABEL[r]} – ${label}`}
                          />
                          {p === "dashboard" && <input type="hidden" name={`${r}:${p}`} value="on" />}
                        </td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            </TableWrap>
          </Section>
        ))}
        <div className="flex flex-wrap items-center gap-2">
          <Submit>Save permissions</Submit>
          <Submit className="btn-ghost" name="_reset" value="1" confirm="Put every role back to the factory permissions?">Reset to defaults</Submit>
          <span className="text-xs text-gray-500">Changes are written to the activity log.</span>
        </div>
      </ActionForm>
    </>
  );
}
