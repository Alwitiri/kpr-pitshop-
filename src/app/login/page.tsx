import { redirect } from "next/navigation";
import { getSession } from "@/lib/auth";
import { login } from "@/actions/auth";
import { ActionForm, Submit } from "@/components/forms";

export const metadata = { title: "Login" };

export default async function LoginPage() {
  if (await getSession()) redirect("/");
  return (
    <main className="flex min-h-screen items-center justify-center bg-gray-950 px-4">
      <div className="w-full max-w-sm">
        <div className="mb-6 text-center">
          <div className="mx-auto mb-3 flex h-14 w-14 items-center justify-center rounded-2xl bg-brand-600 text-xl font-black text-white">
            KPR
          </div>
          <h1 className="text-2xl font-bold text-white">KPR Pitstop N Sportz</h1>
          <p className="text-sm text-gray-400">Business Management System</p>
        </div>
        <div className="card p-6">
          <ActionForm action={login} className="space-y-4">
            <label className="block">
              <span className="label">Username</span>
              <input name="username" className="input" autoFocus autoComplete="username" required />
            </label>
            <label className="block">
              <span className="label">Password</span>
              <input name="password" type="password" className="input" autoComplete="current-password" required />
            </label>
            <Submit className="btn-primary w-full">Log in</Submit>
          </ActionForm>
        </div>
      </div>
    </main>
  );
}
