import { notFound } from "next/navigation";
import { db } from "@/lib/db";
import { requirePage } from "@/lib/auth";
import { fmtDateTime } from "@/lib/format";
import { PageHeader, Section } from "@/components/ui";
import { Submit } from "@/components/forms";
import { WaBubble } from "@/components/wa-text";
import { deleteCampaign } from "@/actions/whatsapp";
import { composeMessage } from "@/lib/whatsapp";
import { CampaignRunner } from "./runner";

export async function generateMetadata({ params }: { params: Promise<{ id: string }> }) {
  const c = await db.waCampaign.findUnique({ where: { id: Number((await params).id) || 0 }, select: { name: true } });
  return { title: c?.name ?? "WhatsApp offer" };
}

export default async function CampaignPage({ params }: { params: Promise<{ id: string }> }) {
  await requirePage("whatsapp");
  const id = Number((await params).id);
  const c = await db.waCampaign.findUnique({ where: { id }, include: { recipients: { orderBy: { id: "asc" } } } });
  if (!c) notFound();
  // Show the message as the first customer will see it
  const first = c.recipients[0];
  const preview = first ? (await composeMessage({ kind: "OFFER", customerId: first.customerId, body: c.body, phone: first.phone })).text : c.body;

  return (
    <>
      <PageHeader
        title={c.name}
        subtitle={`${c.audience} · created ${fmtDateTime(c.createdAt)}`}
        back="/whatsapp"
        actions={
          <form action={deleteCampaign}>
            <input type="hidden" name="id" value={c.id} />
            <Submit className="btn-ghost text-red-600" confirm="Delete this offer and its send list? Messages already sent stay in WhatsApp.">Delete</Submit>
          </form>
        }
      />
      <div className="grid gap-5 xl:grid-cols-[1fr_380px]">
        <CampaignRunner recipients={c.recipients.map((r) => ({ id: r.id, name: r.name, phone: r.phone, status: r.status, customerId: r.customerId }))} />
        <div className="space-y-5">
          <Section title="Message">
            <WaBubble text={preview} />
            <p className="mt-2 text-xs text-gray-500">{first ? `As ${first.name} will see it. ` : ""}Each customer gets their own name.</p>
          </Section>
          <Section title="Tips">
            <ul className="list-disc space-y-1.5 pl-4 text-sm text-gray-600">
              <li>Keep WhatsApp Desktop open next to this window. Click <b>Send next</b>, press Enter in WhatsApp, come back, repeat.</li>
              <li>Sending a few dozen at a steady pace is safest. Sending hundreds in minutes to people who never chatted with you can get a number restricted by WhatsApp.</li>
              <li>If someone replies STOP, click <b>Opted out</b> on their row – they will not get offers again.</li>
            </ul>
          </Section>
        </div>
      </div>
    </>
  );
}
