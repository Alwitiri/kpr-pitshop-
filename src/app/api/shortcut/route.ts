import { getSession } from "@/lib/auth";
import { appPort, computerName, lanAddresses } from "@/lib/network";

export const dynamic = "force-dynamic";

/** Windows shortcut (.url) for a second counter PC – opens Spoaxio Software on the shop PC. */
export async function GET(req: Request) {
  if (!(await getSession())) return new Response("Please log in.", { status: 401 });
  const addr = new URL(req.url).searchParams.get("addr") ?? "";
  // Only this PC's own addresses (or its name) – never an arbitrary website
  const known = [...lanAddresses().map((a) => a.address), computerName()];
  if (!known.includes(addr)) return new Response("Unknown address.", { status: 400 });
  const base = `http://${addr}:${appPort()}`;
  const body = ["[InternetShortcut]", `URL=${base}/`, `IconFile=${base}/favicon.ico`, "IconIndex=0", ""].join("\r\n");
  return new Response(body, {
    headers: {
      "Content-Type": "application/internet-shortcut",
      "Content-Disposition": 'attachment; filename="Spoaxio Software.url"',
      "Cache-Control": "no-store",
    },
  });
}
