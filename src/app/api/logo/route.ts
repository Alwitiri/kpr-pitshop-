import { readLogo } from "@/lib/branding";

// Public on purpose: the login screen shows the shop's logo before anyone signs in.
export async function GET() {
  const logo = await readLogo();
  if (!logo) return new Response("No logo", { status: 404 });
  return new Response(new Uint8Array(logo.data), {
    headers: {
      "Content-Type": logo.type,
      "Cache-Control": "public, max-age=31536000, immutable", // URL changes (?v=) when the logo changes
      "X-Content-Type-Options": "nosniff",
    },
  });
}
