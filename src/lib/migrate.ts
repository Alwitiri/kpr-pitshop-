import "server-only";
import { readdir, readFile } from "node:fs/promises";
import { db } from "./db";
import { migrationsDir } from "./paths";

/**
 * Applies prisma/migrations-sql/*.sql in order, once each, recorded in "_AppMigration".
 * This lets an installed copy upgrade its own database with no developer tools on the PC.
 */
export async function applyMigrations() {
  await db.$executeRawUnsafe(
    `CREATE TABLE IF NOT EXISTS "_AppMigration" ("name" TEXT NOT NULL PRIMARY KEY, "appliedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP)`,
  );
  const applied = new Set(
    (await db.$queryRawUnsafe<{ name: string }[]>(`SELECT "name" FROM "_AppMigration"`)).map((r) => r.name),
  );

  let files: string[] = [];
  try {
    files = (await readdir(migrationsDir())).filter((f) => f.endsWith(".sql")).sort();
  } catch {
    console.warn("[kpr] migrations folder not found:", migrationsDir());
    return;
  }

  // A database created earlier with `prisma db push` already has the base tables.
  if (!applied.has("0001_init.sql")) {
    const t = await db.$queryRawUnsafe<{ n: number }[]>(`SELECT COUNT(*) AS n FROM sqlite_master WHERE type='table' AND name='User'`);
    if (Number(t[0]?.n ?? 0) > 0) {
      await db.$executeRawUnsafe(`INSERT INTO "_AppMigration" ("name") VALUES ('0001_init.sql')`);
      applied.add("0001_init.sql");
    }
  }

  for (const f of files) {
    if (applied.has(f)) continue;
    const sql = await readFile(`${migrationsDir()}/${f}`, "utf8");
    const statements = sql
      .split(/;\s*(?:\r?\n|$)/)
      .map((s) => s.replace(/^\s*--.*$/gm, "").trim())
      .filter(Boolean);
    await db.$transaction(async (tx) => {
      for (const s of statements) await tx.$executeRawUnsafe(s);
      await tx.$executeRawUnsafe(`INSERT INTO "_AppMigration" ("name") VALUES (?)`, f);
    });
    console.log(`[kpr] applied migration ${f}`);
  }
}
