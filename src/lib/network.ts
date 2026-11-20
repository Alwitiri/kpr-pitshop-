import "server-only";
import { execFile, spawn } from "node:child_process";
import { existsSync } from "node:fs";
import os from "node:os";
import path from "node:path";

/**
 * Other phones / PCs on the shop Wi-Fi reach Spoaxio Software at http://<this PC's address>:<port>.
 * Everything here runs on the shop PC; nothing goes to the internet.
 */
export const appPort = () => process.env.PORT ?? "3000";

const VIRTUAL = /(vEthernet|VirtualBox|VMware|Hyper-V|WSL|Loopback|Bluetooth|Tailscale|ZeroTier|Npcap|TAP-|Docker)/i;

/** This PC's addresses on the local network, real Wi-Fi / Ethernet adapters first. */
export function lanAddresses(): { name: string; address: string; kind: "wifi" | "ethernet" | "other" }[] {
  const out: { name: string; address: string; kind: "wifi" | "ethernet" | "other" }[] = [];
  for (const [name, list] of Object.entries(os.networkInterfaces())) {
    for (const i of list ?? []) {
      if (i.family !== "IPv4" || i.internal || i.address.startsWith("169.254.")) continue;
      if (VIRTUAL.test(name)) continue;
      out.push({ name, address: i.address, kind: /wi-?fi|wlan|wireless/i.test(name) ? "wifi" : /ethernet|^eth|^en/i.test(name) ? "ethernet" : "other" });
    }
  }
  const rank = { wifi: 0, ethernet: 1, other: 2 };
  return out.sort((a, b) => rank[a.kind] - rank[b.kind]);
}

export const computerName = () => os.hostname();

/** True when the request comes from the shop PC itself. */
export function isLocalHost(host: string | null | undefined) {
  const name = (host ?? "").replace(/:\d+$/, "").replace(/^\[|\]$/g, "").toLowerCase();
  return ["localhost", "127.0.0.1", "::1"].includes(name);
}

export type FirewallStatus = {
  checked: boolean; // false on non-Windows / when the check failed
  allowed: boolean;
  networkCategory: string; // Public / Private / DomainAuthenticated
  rules: { action: string; profile: string }[];
  note?: string;
};

const fwCache = globalThis as unknown as { __kprFw?: { at: number; v: FirewallStatus } };

const run = (args: string[]) =>
  new Promise<string | null>((resolve) =>
    execFile("netsh.exe", args, { timeout: 20_000, windowsHide: true, maxBuffer: 64 * 1024 * 1024 }, (err, out) => resolve(err ? null : out)),
  );

/** "%ProgramFiles%\x" → "C:\Program Files\x", lower-case, for comparing program paths. */
const normPath = (p: string) => p.replace(/%([^%]+)%/g, (_, v) => process.env[v] ?? `%${v}%`).trim().toLowerCase();

/**
 * Does Windows Firewall let other devices reach this app on the current network? (< 1 s, cached 60 s)
 * Uses Windows' own "netsh" tool (fast, no PowerShell). Matches rules for this app's node.exe –
 * that covers the "Spoaxio Software" rule, the old "KPR Pitstop" one and Windows' own "Allow access"
 * prompt – and rules opened for this app's port.
 */
export async function firewallStatus(force = false): Promise<FirewallStatus> {
  if (!force && fwCache.__kprFw && Date.now() - fwCache.__kprFw.at < 60_000) return fwCache.__kprFw.v;
  if (process.platform !== "win32") return { checked: false, allowed: true, networkCategory: "", rules: [], note: "Not a Windows PC." };
  const fail: FirewallStatus = { checked: false, allowed: false, networkCategory: "", rules: [], note: "Could not read the Windows Firewall settings." };
  const [current, all] = await Promise.all([
    run(["advfirewall", "show", "currentprofile"]),
    run(["advfirewall", "firewall", "show", "rule", "name=all", "dir=in", "verbose"]),
  ]);
  if (!current || !all) return (fwCache.__kprFw = { at: Date.now(), v: fail }).v;

  // e.g. "Public Profile Settings:" … "State   ON"
  const cat = current.match(/^\s*(Domain|Private|Public) Profile Settings/im)?.[1];
  const on = /^\s*State\s+ON\s*$/im.test(current);
  const blocks = all.split(/\r?\n\s*\r?\n/);
  if (!cat || !blocks.some((b) => /^Rule Name:/im.test(b))) {
    // Windows in another language – the labels differ, so we cannot read them reliably
    const v = { ...fail, note: "Windows Firewall could not be read on this PC (language). Use Start menu → Spoaxio Software → Allow phones & other PCs to be sure." };
    return (fwCache.__kprFw = { at: Date.now(), v }).v;
  }
  const field = (b: string, name: string) => b.match(new RegExp(`^${name}:\\s*(.+)$`, "im"))?.[1]?.trim() ?? "";
  const exe = normPath(process.execPath);
  const port = appPort();
  const rules: { action: string; profile: string }[] = [];
  for (const b of blocks) {
    if (!/^Rule Name:/im.test(b) || field(b, "Enabled") !== "Yes") continue;
    const program = field(b, "Program");
    const ports = field(b, "LocalPort");
    const proto = field(b, "Protocol");
    const forThisApp = (program && program !== "Any" && normPath(program) === exe) ||
      ((program === "" || program === "Any") && (proto === "TCP" || proto === "Any") && ports.split(",").map((x) => x.trim()).includes(port));
    if (forThisApp) rules.push({ action: field(b, "Action"), profile: field(b, "Profiles") });
  }
  const covers = (p: string) => /any/i.test(p) || p.split(/,\s*/).includes(cat);
  const blocked = rules.some((r) => r.action === "Block" && covers(r.profile));
  const allowed = !on || (!blocked && rules.some((r) => r.action === "Allow" && covers(r.profile)));
  const v: FirewallStatus = { checked: true, allowed, networkCategory: cat, rules, note: blocked ? "A Windows Firewall rule BLOCKS this app on this network." : undefined };
  return (fwCache.__kprFw = { at: Date.now(), v }).v;
}

/** Script that adds the firewall rule (asks Windows for administrator approval). */
function allowScript() {
  const c = [path.resolve(process.cwd(), "..", "allow-network.ps1"), path.resolve(process.cwd(), "packaging", "allow-network.ps1")];
  return c.find((p) => existsSync(p)) ?? null;
}

/** Opens the Windows administrator prompt on the shop PC to allow phones / other PCs. */
export function requestFirewallAllow(): { ok: boolean; error?: string } {
  if (process.platform !== "win32") return { ok: false, error: "Only on a Windows PC." };
  const script = allowScript();
  if (!script) return { ok: false, error: "The allow-network script is missing – reinstall Spoaxio Software." };
  const child = spawn("powershell.exe", ["-NoProfile", "-ExecutionPolicy", "Bypass", "-WindowStyle", "Hidden", "-File", script, "-Exe", process.execPath], {
    detached: true,
    stdio: "ignore",
    windowsHide: true,
  });
  child.on("error", () => null);
  child.unref();
  delete fwCache.__kprFw;
  return { ok: true };
}

// ── Devices using the app ──

export type Device = { key: string; ip: string; label: string; user: string; role: string; lastSeen: number; firstSeen: number; thisPc: boolean };
const devStore = globalThis as unknown as { __kprDevices?: Map<string, Device> };

export function deviceLabel(ua: string) {
  const os_ = /iPhone/.test(ua) ? "iPhone" : /iPad/.test(ua) ? "iPad" : /Android/.test(ua) ? (/Mobile/.test(ua) ? "Android phone" : "Android tablet") : /Windows/.test(ua) ? "Windows PC" : /Mac OS X/.test(ua) ? "Mac" : /Linux/.test(ua) ? "Linux PC" : "Device";
  const br = /Edg\//.test(ua) ? "Edge" : /SamsungBrowser/.test(ua) ? "Samsung Internet" : /Chrome\//.test(ua) ? "Chrome" : /Firefox\//.test(ua) ? "Firefox" : /Safari\//.test(ua) ? "Safari" : "browser";
  return `${os_} · ${br}`;
}

/** Remember who is using the app from where (kept in memory while the app runs). */
export function recordDevice(h: Headers, user: { name: string; role: string }) {
  const ua = h.get("user-agent") ?? "";
  const raw = (h.get("x-forwarded-for") ?? "").split(",")[0].trim() || h.get("x-real-ip") || "";
  const ip = raw.replace(/^::ffff:/, "");
  const thisPc = isLocalHost(h.get("host")) || ip === "127.0.0.1" || ip === "::1" || lanAddresses().some((a) => a.address === ip);
  const key = `${thisPc ? "local" : ip}|${deviceLabel(ua)}|${user.name}`;
  const m = (devStore.__kprDevices ??= new Map());
  const now = Date.now();
  const d = m.get(key);
  if (d) {
    d.lastSeen = now;
    d.ip = ip || d.ip;
  } else {
    m.set(key, { key, ip: thisPc ? "this PC" : ip || "?", label: deviceLabel(ua), user: user.name, role: user.role, lastSeen: now, firstSeen: now, thisPc });
    if (m.size > 200) [...m.values()].sort((a, b) => a.lastSeen - b.lastSeen).slice(0, 50).forEach((x) => m.delete(x.key));
  }
}

export function listDevices() {
  return [...(devStore.__kprDevices?.values() ?? [])].sort((a, b) => b.lastSeen - a.lastSeen);
}
