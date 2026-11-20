import { createSession, redeemHandoffToken } from "@/lib/auth";

export const dynamic = "force-dynamic";

/** Logs in the server-opened print window (one-time link) and goes to the page to print. */
export async function GET(req: Request) {
  const url = new URL(req.url);
  const next = url.searchParams.get("next") ?? "/";
  const s = await redeemHandoffToken(url.searchParams.get("t") ?? "");
  if (!s) return new Response("This print link has expired.", { status: 403 });
  // Only pages of this app – never another website
  if (!next.startsWith("/") || next.startsWith("//")) return new Response("Bad link.", { status: 400 });
  await createSession(s);
  return new Response(null, { status: 303, headers: { Location: next, "Cache-Control": "no-store" } });
}
