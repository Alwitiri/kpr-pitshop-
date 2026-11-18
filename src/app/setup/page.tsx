import { redirect } from "next/navigation";
import { db } from "@/lib/db";
import { firstRunSetup } from "@/actions/setup";
import { ActionForm, Submit } from "@/components/forms";

export const metadata = { title: "Welcome" };

export default async function SetupPage() {
  if ((await db.user.count()) > 0) redirect("/login");
  return (
    <main className="flex min-h-screen items-center justify-center bg-gray-950 px-4 py-10">
      <div className="w-full max-w-lg">
        <div className="mb-6 text-center">
          <div className="mx-auto mb-3 flex h-14 w-14 items-center justify-center rounded-2xl bg-brand-600 text-xl font-black text-white">KPR</div>
          <h1 className="text-2xl font-bold text-white">Welcome! Let&apos;s set up the shop</h1>
          <p className="text-sm text-gray-400">This appears only once. You can change everything later in Settings.</p>
        </div>
        <div className="card p-6">
          <ActionForm action={firstRunSetup} className="space-y-4">
            <div className="grid gap-4 sm:grid-cols-2">
              <label className="sm:col-span-2"><span className="label">Shop name *</span><input name="shopName" className="input" defaultValue="KPR Pitstop N Sportz" required /></label>
              <label><span className="label">Shop phone</span><input name="phone" className="input" /></label>
              <label><span className="label">GSTIN</span><input name="gstin" className="input uppercase" maxLength={15} /></label>
              <label className="sm:col-span-2"><span className="label">Address</span><input name="address" className="input" /></label>
            </div>
            <hr />
            <p className="text-sm font-semibold">Owner login</p>
            <div className="grid gap-4 sm:grid-cols-2">
              <label><span className="label">Owner name *</span><input name="name" className="input" required /></label>
              <label><span className="label">Username *</span><input name="username" className="input lowercase" defaultValue="owner" required /></label>
              <label><span className="label">Password *</span><input name="password" type="password" minLength={6} className="input" autoComplete="new-password" required /></label>
              <label><span className="label">Confirm password *</span><input name="confirm" type="password" minLength={6} className="input" autoComplete="new-password" required /></label>
            </div>
            <label className="flex items-center gap-2 text-sm"><input type="checkbox" name="categories" defaultChecked className="h-4 w-4" /> Add standard bike & car accessory categories</label>
            <Submit className="btn-primary w-full">Start using the software</Submit>
          </ActionForm>
        </div>
      </div>
    </main>
  );
}
