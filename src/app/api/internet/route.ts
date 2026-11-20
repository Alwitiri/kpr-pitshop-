import { getSession } from "@/lib/auth";
import { checkInternet } from "@/lib/internet";
import { db } from "@/lib/db";

export const dynamic = "force-dynamic";

/** Internet status for the menu light, plus how many WhatsApp messages are waiting. */
export async function GET(req: Request) {
  const s = await getSession();
  if (!s) return Response.json({ error: "login" }, { status: 401 });
  const force = new URL(req.url).searchParams.has("force");
  const [online, queued] = await Promise.all([checkInternet(force), db.waMessage.count({ where: { status: "QUEUED", channel: "CLICK" } })]);
  return Response.json({ online, queued, checkedAt: Date.now() }, { headers: { "Cache-Control": "no-store" } });
}
