import "server-only";
import { copyFile, mkdir, readdir, rm, stat, writeFile } from "node:fs/promises";
import path from "node:path";
import { db } from "./db";
import { backupDir, dbFilePath } from "./paths";
import { applyMigrations } from "./migrate";

const KEEP_AUTO = 30;
const stamp = () => {
  const d = new Date();
  const p = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}_${p(d.getHours())}${p(d.getMinutes())}${p(d.getSeconds())}`;
};

export type BackupFile = { name: string; size: number; createdAt: Date; kind: string };

/** Consistent snapshot of the live database (safe while the shop is billing). */
export async function backupNow(kind: "auto" | "manual" | "before-restore" = "manual") {
  await mkdir(backupDir(), { recursive: true });
  const name = `kpr-${kind}-${stamp()}.db`;
  const file = path.join(backupDir(), name);
  await db.$executeRawUnsafe(`VACUUM INTO '${file.replace(/'/g, "''")}'`);
  if (kind === "auto") await pruneAuto();
  return name;
}

export async function listBackups(): Promise<BackupFile[]> {
  try {
    const names = (await readdir(backupDir())).filter((n) => /^kpr-.*\.db$/.test(n));
    const out = await Promise.all(
      names.map(async (name) => {
        const s = await stat(path.join(backupDir(), name));
        const kind = name.match(/^kpr-([a-z-]+?)-\d/)?.[1] ?? "manual";
        return { name, size: s.size, createdAt: s.mtime, kind: kind.replace(/-/g, " ") };
      }),
    );
    return out.sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());
  } catch {
    return [];
  }
}

async function pruneAuto() {
  const auto = (await listBackups()).filter((b) => b.kind === "auto");
  for (const b of auto.slice(KEEP_AUTO)) await rm(path.join(backupDir(), b.name), { force: true });
}

/** Safe file name inside the backup folder, or null. */
export function backupPath(name: string) {
  if (!/^kpr-[a-z-]+-[\d_-]+\.db$/.test(name)) return null;
  return path.join(backupDir(), name);
}

/** Take an automatic backup if the newest one is older than 20 hours. */
export async function autoBackupIfDue() {
  const latest = (await listBackups()).find((b) => b.kind === "auto");
  if (!latest || Date.now() - latest.createdAt.getTime() > 20 * 3600e3) {
    const name = await backupNow("auto");
    console.log(`[kpr] automatic backup ${name}`);
  }
}

/** Replace the live database with an uploaded / chosen backup. A safety copy is taken first. */
export async function restoreFrom(data: Buffer) {
  if (data.length < 100 || data.subarray(0, 16).toString("latin1") !== "SQLite format 3\u0000") {
    throw new Error("That file is not a KPR backup (.db) file.");
  }
  const safety = await backupNow("before-restore");
  const live = dbFilePath();
  const tmp = `${live}.restoring`;
  await writeFile(tmp, data);
  await db.$disconnect();
  await rm(`${live}-wal`, { force: true });
  await rm(`${live}-shm`, { force: true });
  await copyFile(tmp, live);
  await rm(tmp, { force: true });
  await applyMigrations(); // reconnects and upgrades older backups
  return safety;
}
