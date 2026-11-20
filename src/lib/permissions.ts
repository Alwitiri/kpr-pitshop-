import "server-only";
import { db } from "./db";
import { ALL_PERMS, setPermissionOverrides, type Perm } from "./roles";

const state = globalThis as unknown as { __kprPermsLoadedAt?: number };
const TTL = 30_000; // other server processes / restores pick up changes within 30 s

/** Load the owner's saved role permissions into memory (cached). */
export async function loadPermissions(force = false) {
  if (!force && state.__kprPermsLoadedAt && Date.now() - state.__kprPermsLoadedAt < TTL) return;
  try {
    const rows = await db.rolePermission.findMany();
    const map: Record<string, Perm[]> = {};
    for (const r of rows) {
      try {
        const list = JSON.parse(r.perms) as string[];
        map[r.role] = list.filter((p): p is Perm => (ALL_PERMS as string[]).includes(p));
      } catch {
        /* ignore a damaged row – defaults apply */
      }
    }
    setPermissionOverrides(map);
    state.__kprPermsLoadedAt = Date.now();
  } catch {
    // Table missing (database not upgraded yet) – the built-in defaults apply.
  }
}
