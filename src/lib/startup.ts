import "server-only";
import { db } from "./db";
import { applyMigrations } from "./migrate";
import { autoBackupIfDue } from "./backup";

let started = false;

/** Runs once when the server starts: prepare the database, then keep daily backups going. */
export async function startup() {
  if (started) return;
  started = true;
  // Better behaviour with several counters / phones using the shop PC at once
  await db.$queryRawUnsafe(`PRAGMA journal_mode=WAL`);
  await db.$queryRawUnsafe(`PRAGMA busy_timeout=5000`);
  await applyMigrations();
  const settings = await db.shopSettings.findUnique({ where: { id: 1 } });
  if (!settings) await db.shopSettings.create({ data: { id: 1 } });

  const tick = () => autoBackupIfDue().catch((e) => console.error("[kpr] backup failed", e));
  setTimeout(tick, 15_000);
  setInterval(tick, 60 * 60 * 1000).unref();
}
