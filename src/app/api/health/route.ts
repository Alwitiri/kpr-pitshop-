// Used by the desktop launcher to know the app is up.
export function GET() {
  return Response.json({ ok: true, app: "kpr-pitstop" });
}
