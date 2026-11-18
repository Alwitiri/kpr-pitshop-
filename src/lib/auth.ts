import "server-only";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { SignJWT, jwtVerify } from "jose";
import { can, type Module } from "./roles";

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
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: 60 * 60 * 12,
  });
}

export async function destroySession() {
  (await cookies()).delete(COOKIE);
}

export async function getSession(): Promise<Session | null> {
  const token = (await cookies()).get(COOKIE)?.value;
  if (!token) return null;
  try {
    const { payload } = await jwtVerify(token, secret);
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
export async function requirePage(module?: Module): Promise<Session> {
  const s = await getSession();
  if (!s) redirect("/login");
  if (module && !can(s.role, module)) redirect("/?denied=" + module);
  return s;
}

/** For server actions: throw when not allowed. */
export async function requireAction(module?: Module): Promise<Session> {
  const s = await getSession();
  if (!s) throw new Error("Your session has expired. Please log in again.");
  if (module && !can(s.role, module)) throw new Error("You do not have permission for this action.");
  return s;
}
