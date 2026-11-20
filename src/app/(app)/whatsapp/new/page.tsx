import { requirePage } from "@/lib/auth";
import { templateFor } from "@/lib/whatsapp";
import { SEGMENTS, SEGMENT_ORDER } from "@/lib/crm";
import { PageHeader } from "@/components/ui";
import { CampaignForm } from "./campaign-form";

export const metadata = { title: "New WhatsApp offer" };

export default async function NewOfferPage() {
  await requirePage("whatsapp");
  const body = await templateFor("OFFER");
  return (
    <>
      <PageHeader title="New WhatsApp offer" subtitle="Choose who gets it and write the message. Only customers who agreed to offers are included." back="/whatsapp" />
      <CampaignForm defaultBody={body} segments={SEGMENT_ORDER.map((k) => [k, SEGMENTS[k].label])} />
    </>
  );
}
