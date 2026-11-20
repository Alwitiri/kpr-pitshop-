import { requirePage } from "@/lib/auth";
import { ROLE_LABEL } from "@/lib/roles";
import { PageHeader, Section } from "@/components/ui";
import { ActionForm, PasswordInput, Submit } from "@/components/forms";
import { changeOwnPassword } from "@/actions/auth";

export const metadata = { title: "My account" };

export default async function AccountPage() {
  const s = await requirePage();
  return (
    <>
      <PageHeader title="My account" subtitle={`${s.name} · ${ROLE_LABEL[s.role]} · @${s.username}`} />
      <Section title="Change password" className="max-w-md">
        <ActionForm action={changeOwnPassword} resetOnSuccess className="space-y-3">
          <label className="block"><span className="label">Current password</span><PasswordInput name="current" /></label>
          <label className="block"><span className="label">New password</span><PasswordInput name="next" autoComplete="new-password" minLength={6} /></label>
          <Submit>Change password</Submit>
        </ActionForm>
      </Section>
    </>
  );
}
