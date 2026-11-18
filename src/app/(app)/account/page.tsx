import { requirePage } from "@/lib/auth";
import { ROLE_LABEL } from "@/lib/roles";
import { PageHeader, Section } from "@/components/ui";
import { ActionForm, Submit } from "@/components/forms";
import { changeOwnPassword } from "@/actions/auth";

export const metadata = { title: "My account" };

export default async function AccountPage() {
  const s = await requirePage();
  return (
    <>
      <PageHeader title="My account" subtitle={`${s.name} · ${ROLE_LABEL[s.role]} · @${s.username}`} />
      <Section title="Change password" className="max-w-md">
        <ActionForm action={changeOwnPassword} resetOnSuccess className="space-y-3">
          <label className="block"><span className="label">Current password</span><input name="current" type="password" className="input" required /></label>
          <label className="block"><span className="label">New password</span><input name="next" type="password" minLength={6} className="input" required /></label>
          <Submit>Change password</Submit>
        </ActionForm>
      </Section>
    </>
  );
}
