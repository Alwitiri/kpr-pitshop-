import { redirect } from "next/navigation";
import { getSession } from "@/lib/auth";
import { db } from "@/lib/db";
import { login } from "@/actions/auth";
import { ActionForm, PasswordInput, Submit } from "@/components/forms";
import { BrandMark } from "@/components/brand";
import { MadeBy } from "@/components/made-by";
import { getSettings } from "@/lib/server-utils";
import { logoUrl } from "@/lib/branding";

// Must check the live database on every request (never pre-rendered at build time)
export const dynamic = "force-dynamic";

export const metadata = { title: "Login" };

export default async function LoginPage() {
  if ((await db.user.count()) === 0) redirect("/setup");
  if (await getSession()) redirect("/");
  const [settings, logo] = await Promise.all([getSettings(), logoUrl()]);
  return (
    <main className="relative flex min-h-dvh items-center justify-center overflow-hidden bg-gray-950 px-4 py-10">
      <div className="pointer-events-none absolute -top-40 left-1/2 h-[480px] w-[720px] -translate-x-1/2 rounded-full bg-brand-600/20 blur-3xl" aria-hidden />
      <div className="page-enter relative w-full max-w-sm">
        <div className="mb-6 text-center">
          <BrandMark logo={logo} name={settings.shopName} size={logo ? 104 : 64} className="mx-auto mb-3 shadow-lg" />
          <h1 className="text-2xl font-bold text-white">{settings.shopName}</h1>
          <p className="text-sm text-gray-400">{settings.tagline || "Business Management System"}</p>
        </div>
        <div className="card p-6 shadow-2xl shadow-black/40">
          <h2 className="mb-4 text-lg font-semibold text-gray-950">Log in to continue</h2>
          <ActionForm action={login} className="space-y-4">
            <label className="block">
              <span className="label">Username</span>
              <input name="username" className="input" autoFocus autoComplete="username" required />
            </label>
            <label className="block">
              <span className="label">Password</span>
              <PasswordInput />
            </label>
            <Submit className="btn-primary min-h-11 w-full text-base">Log in</Submit>
          </ActionForm>
          <details className="mt-4 text-xs text-gray-600">
            <summary className="cursor-pointer font-medium text-link hover:underline">Forgot username or password?</summary>
            <ul className="mt-2 list-disc space-y-1 pl-4">
              <li><b>Staff:</b> ask the owner. They can set a new password in <i>Staff → Edit</i>.</li>
              <li>
                <b>Owner:</b> on the main shop computer, open the <b>Start menu → Spoaxio Software → Reset password</b>.
                It lists all usernames and lets you set a new password.
              </li>
            </ul>
          </details>
        </div>
        <MadeBy className="mt-6" />
      </div>
    </main>
  );
}
