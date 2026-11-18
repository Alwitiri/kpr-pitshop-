import { db } from "@/lib/db";
import { requirePage } from "@/lib/auth";
import { PageHeader } from "@/components/ui";
import { NewJobForm } from "./new-job-form";

export const metadata = { title: "New job card" };

export default async function NewJobPage({ searchParams }: { searchParams: Promise<{ customer?: string }> }) {
  await requirePage("jobcards");
  const cid = Number((await searchParams).customer) || null;
  const [techs, customer] = await Promise.all([
    db.user.findMany({ where: { active: true, role: { in: ["TECHNICIAN", "MANAGER", "OWNER"] } }, select: { id: true, name: true }, orderBy: { name: "asc" } }),
    cid ? db.customer.findUnique({ where: { id: cid }, include: { vehicles: true } }) : null,
  ]);
  return (
    <>
      <PageHeader title="New job card" subtitle="Vehicle check-in for fitting / installation / service" back="/jobcards" />
      <NewJobForm techs={techs} initialCustomer={customer} />
    </>
  );
}
