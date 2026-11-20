import "server-only";
import { lookup } from "node:dns/promises";

/**
 * Is the shop PC connected to the internet (can it reach WhatsApp)?
 * The rest of the software works offline; only WhatsApp needs this.
 * Cached for 20 s so many screens / devices asking at once cause one check.
 */
const cache = globalThis as unknown as { __kprNet?: { online: boolean; at: number; pending?: Promise<boolean> } };
const TTL = 20_000;

async function probe(): Promise<boolean> {
  try {
    // A real request proves the connection works (not just that a network cable is plugged in).
    const r = await fetch("https://web.whatsapp.com/", { method: "HEAD", redirect: "manual", signal: AbortSignal.timeout(4000), cache: "no-store" });
    return r.status > 0;
  } catch {
    try {
      // Some networks block HEAD requests: a name lookup still tells us DNS / internet is reachable.
      await Promise.race([lookup("web.whatsapp.com"), new Promise((_, no) => setTimeout(() => no(new Error("timeout")), 3000))]);
      return true;
    } catch {
      return false;
    }
  }
}

export async function checkInternet(force = false): Promise<boolean> {
  // Testing / support: KPR_FORCE_OFFLINE=1 makes the app behave as if the internet is down.
  if (process.env.KPR_FORCE_OFFLINE === "1") return false;
  const c = cache.__kprNet;
  if (!force && c && Date.now() - c.at < TTL) return c.online;
  if (c?.pending) return c.pending;
  const pending = probe().then((online) => {
    cache.__kprNet = { online, at: Date.now() };
    return online;
  });
  cache.__kprNet = { online: c?.online ?? true, at: c?.at ?? 0, pending };
  return pending;
}
