"use server";

import { headers } from "next/headers";
import { requireAction } from "@/lib/auth";
import { firewallStatus, isLocalHost, requestFirewallAllow, type FirewallStatus } from "@/lib/network";
import { audit } from "@/lib/server-utils";

export async function checkFirewall(force = false): Promise<FirewallStatus> {
  await requireAction("settings");
  return firewallStatus(force);
}

/** Owner, on the shop PC: open the Windows "allow" prompt for phones and other PCs. */
export async function allowOtherDevices(): Promise<{ ok?: string; error?: string }> {
  const s = await requireAction("settings");
  if (s.role !== "OWNER") return { error: "Only the owner can change this." };
  if (!isLocalHost((await headers()).get("host"))) return { error: "Do this on the shop PC itself (the one running Spoaxio Software)." };
  const r = requestFirewallAllow();
  if (!r.ok) return { error: r.error };
  await audit(s.uid, "FIREWALL_ALLOW_REQUESTED", "Network", null);
  return { ok: "Windows is asking for permission – click “Yes” on the shop PC screen. Then press “Check again”." };
}
