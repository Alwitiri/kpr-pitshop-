import "server-only";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { SignJWT, jwtVerify } from "jose";
import { can, type Perm } from "./roles";
import { loadPermissions } from "./permissions";

const COOKIE = "kpr_session";
const secret = new TextEncoder().encode(
  process.env.AUTH_SECRET ?? "dev-only-change-me-kpr-pitstop-secret-key-2026",
);

export type Session = { uid: number; name: string; role: string; username: string };

export async function createSession(s: Session) {
  const token = await new SignJWT({ ...s })
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setExpirationTime("12h")
    .sign(secret);
  (await cookies()).set(COOKIE, token, {
    httpOnly: true,
    sameSite: "lax",
    // Shop PCs and phones reach the app over plain http on the local network
    secure: process.env.COOKIE_SECURE === "1",
    path: "/",
    maxAge: 60 * 60 * 12,
  });
}

/**
 * One-time, 60-second login link for a print window the server opens on the shop PC
 * (it runs in its own browser profile, so it has no session cookie of its own).
 */
const usedHandoffs = globalThis as unknown as { __kprHandoffs?: Set<string> };
export async function createHandoffToken(s: Session) {
  return new SignJWT({ ...s, typ: "handoff" })
    .setProtectedHeader({ alg: "HS256" })
    .setJti(crypto.randomUUID())
    .setIssuedAt()
    .setExpirationTime("60s")
    .sign(secret);
}
export async function redeemHandoffToken(token: string): Promise<Session | null> {
  try {
    const { payload } = await jwtVerify(token, secret);
    if (payload.typ !== "handoff" || !payload.jti) return null;
    const used = (usedHandoffs.__kprHandoffs ??= new Set());
    if (used.has(payload.jti)) return null; // single use
    used.add(payload.jti);
    if (used.size > 500) used.clear();
    return { uid: Number(payload.uid), name: String(payload.name), role: String(payload.role), username: String(payload.username) };
  } catch {
    return null;
  }
}

export async function destroySession() {
  (await cookies()).delete(COOKIE);
}

export async function getSession(): Promise<Session | null> {
  const token = (await cookies()).get(COOKIE)?.value;
  if (!token) return null;
  try {
    const { payload } = await jwtVerify(token, secret);
    if (payload.typ === "handoff") return null; // a print-window login link is not a session
    return {
      uid: Number(payload.uid),
      name: String(payload.name),
      role: String(payload.role),
      username: String(payload.username),
    };
  } catch {
    return null;
  }
}

/** For pages: redirect to login / dashboard when not allowed. */
export async function requirePage(module?: Perm): Promise<Session> {
  const s = await getSession();
  if (!s) redirect("/login");
  await loadPermissions();
  if (module && !can(s.role, module)) redirect("/?denied=" + module);
  return s;
}

/** For server actions: throw when not allowed. */
export async function requireAction(module?: Perm): Promise<Session> {
  const s = await getSession();
  if (!s) throw new Error("Your session has expired. Please log in again.");
  await loadPermissions();
  if (module && !can(s.role, module)) throw new Error("You do not have permission for this action.");
  return s;
}
