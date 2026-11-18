import "server-only";
import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { randomUUID } from "node:crypto";

// Uploaded files (product images, supplier bills) are stored on disk under
// ./uploads and served through /api/files/... (login required).
// For cloud hosting swap this for Supabase Storage / S3.
export const UPLOAD_ROOT = path.join(process.cwd(), "uploads");

const ALLOWED = new Set([".jpg", ".jpeg", ".png", ".webp", ".gif", ".pdf"]);

export async function saveUpload(file: File | null, folder: "products" | "purchases"): Promise<string | null> {
  if (!file || typeof file === "string" || file.size === 0) return null;
  if (file.size > 5 * 1024 * 1024) throw new Error("File is larger than 5 MB.");
  const ext = path.extname(file.name).toLowerCase();
  if (!ALLOWED.has(ext)) throw new Error("Only JPG, PNG, WEBP, GIF or PDF files are allowed.");
  const dir = path.join(UPLOAD_ROOT, folder);
  await mkdir(dir, { recursive: true });
  const name = `${Date.now()}-${randomUUID().slice(0, 8)}${ext}`;
  await writeFile(path.join(dir, name), Buffer.from(await file.arrayBuffer()));
  return `/api/files/${folder}/${name}`;
}
