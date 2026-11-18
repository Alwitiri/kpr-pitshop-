import { readFile } from "node:fs/promises";
import path from "node:path";
import { getSession } from "@/lib/auth";
import { UPLOAD_ROOT } from "@/lib/storage";

const TYPES: Record<string, string> = {
  ".jpg": "image/jpeg", ".jpeg": "image/jpeg", ".png": "image/png", ".webp": "image/webp", ".gif": "image/gif", ".pdf": "application/pdf",
};

export async function GET(_req: Request, ctx: { params: Promise<{ path: string[] }> }) {
  if (!(await getSession())) return new Response("Unauthorized", { status: 401 });
  const parts = (await ctx.params).path;
  const full = path.normalize(path.join(UPLOAD_ROOT, ...parts));
  if (!full.startsWith(UPLOAD_ROOT + path.sep)) return new Response("Bad path", { status: 400 });
  try {
    const data = await readFile(full);
    return new Response(new Uint8Array(data), {
      headers: { "Content-Type": TYPES[path.extname(full).toLowerCase()] ?? "application/octet-stream", "Cache-Control": "private, max-age=86400" },
    });
  } catch {
    return new Response("Not found", { status: 404 });
  }
}
