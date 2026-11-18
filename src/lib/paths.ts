import "server-only";
import path from "node:path";

/** Absolute path of the SQLite data file, from DATABASE_URL ("file:./dev.db" is relative to /prisma like Prisma does). */
export function dbFilePath() {
  const url = process.env.DATABASE_URL ?? "file:./dev.db";
  const p = url.replace(/^file:/, "").split("?")[0];
  return path.isAbsolute(p) ? p : path.resolve(process.cwd(), "prisma", p);
}

/** Folder that holds the data file, backups and uploads. */
export function dataDir() {
  return process.env.KPR_DATA_DIR ?? path.dirname(dbFilePath());
}

export function backupDir() {
  return process.env.KPR_BACKUP_DIR ?? path.join(dataDir(), "backups");
}

export function uploadDir() {
  return process.env.KPR_UPLOAD_DIR ?? path.join(dataDir(), "uploads");
}

export function migrationsDir() {
  return process.env.KPR_MIGRATIONS_DIR ?? path.join(process.cwd(), "prisma", "migrations-sql");
}
