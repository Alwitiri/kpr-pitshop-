import "server-only";
import { mkdir, readFile, rm, writeFile } from "node:fs/promises";
import path from "node:path";
import { db } from "./db";
import { dataDir } from "./paths";

// Each shop's logo lives in <data>/branding so it survives program updates
// and is included when the data folder is copied to a new PC.
const BRAND_DIR = () => path.join(dataDir(), "branding");

const TYPES: Record<string, string> = { ".png": "image/png", ".jpg": "image/jpeg", ".jpeg": "image/jpeg", ".webp": "image/webp" };

/** Public URL of the logo (changes when a new logo is uploaded, so browsers refresh it), or null. */
export async function logoUrl() {
  const s = await db.shopSettings.findUnique({ where: { id: 1 }, select: { logoFile: true } });
  return s?.logoFile ? `/api/logo?v=${encodeURIComponent(s.logoFile)}` : null;
}

export async function saveLogo(file: File) {
  if (!file || typeof file === "string" || file.size === 0) throw new Error("Choose a logo image.");
  if (file.size > 10 * 1024 * 1024) throw new Error("Logo must be smaller than 10 MB.");
  const ext = path.extname(file.name).toLowerCase();
  if (!TYPES[ext]) throw new Error("Use a PNG, JPG or WEBP image.");
  const buf = Buffer.from(await file.arrayBuffer());
  // Check the file really is an image (magic bytes), not just named like one
  const isPng = buf.subarray(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]));
  const isJpg = buf[0] === 0xff && buf[1] === 0xd8;
  const isWebp = buf.subarray(0, 4).toString("latin1") === "RIFF" && buf.subarray(8, 12).toString("latin1") === "WEBP";
  if (!isPng && !isJpg && !isWebp) throw new Error("That file is not a valid image.");

  await mkdir(BRAND_DIR(), { recursive: true });
  const name = `logo-${Date.now()}${isPng ? ".png" : isJpg ? ".jpg" : ".webp"}`;
  await writeFile(path.join(BRAND_DIR(), name), buf);
  const old = await db.shopSettings.findUnique({ where: { id: 1 }, select: { logoFile: true } });
  await db.shopSettings.upsert({ where: { id: 1 }, create: { id: 1, logoFile: name }, update: { logoFile: name } });
  if (old?.logoFile && old.logoFile !== name) await rm(path.join(BRAND_DIR(), old.logoFile), { force: true });
  return name;
}

export async function removeLogo() {
  const old = await db.shopSettings.findUnique({ where: { id: 1 }, select: { logoFile: true } });
  await db.shopSettings.update({ where: { id: 1 }, data: { logoFile: null } });
  if (old?.logoFile) await rm(path.join(BRAND_DIR(), old.logoFile), { force: true });
}

export async function readLogo() {
  const s = await db.shopSettings.findUnique({ where: { id: 1 }, select: { logoFile: true } });
  if (!s?.logoFile || !/^logo-\d+\.(png|jpg|webp)$/.test(s.logoFile)) return null;
  try {
    const data = await readFile(path.join(BRAND_DIR(), s.logoFile));
    return { data, type: TYPES[path.extname(s.logoFile)] };
  } catch {
    return null;
  }
}
