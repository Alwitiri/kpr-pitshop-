import { readFile } from "node:fs/promises";
import { getSession } from "@/lib/auth";
import { backupPath } from "@/lib/backup";

/** Download one .db backup (owner only) – save it to a pen drive or Google Drive. */
export async function GET(req: Request) {
  const s = await getSession();
  if (!s || s.role !== "OWNER") return new Response("Only the owner can download backups.", { status: 403 });
  const name = new URL(req.url).searchParams.get("name") ?? "";
  const p = backupPath(name);
  if (!p) return new Response("Unknown backup", { status: 400 });
  try {
    const data = await readFile(p);
    return new Response(new Uint8Array(data), {
      headers: { "Content-Type": "application/octet-stream", "Content-Disposition": `attachment; filename="${name}"` },
    });
  } catch {
    return new Response("Not found", { status: 404 });
  }
}
