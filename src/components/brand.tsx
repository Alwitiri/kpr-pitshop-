/** Shop logo, or the shop's initials in a coloured box when no logo has been uploaded. */
export function BrandMark({ logo, name, size = 56, className = "" }: { logo: string | null; name: string; size?: number; className?: string }) {
  if (logo) {
    return (
      // eslint-disable-next-line @next/next/no-img-element
      <img
        src={logo}
        alt={`${name} logo`}
        className={`rounded-xl bg-white object-contain ${className}`}
        style={{ width: size, height: size, padding: Math.round(size * 0.06) }}
      />
    );
  }
  const initials =
    name
      .split(/\s+/)
      .filter((w) => /^[A-Za-z0-9]/.test(w))
      .slice(0, 3)
      .map((w) => w[0])
      .join("")
      .toUpperCase() || "★";
  return (
    <div
      className={`flex items-center justify-center rounded-xl bg-brand-600 font-black text-white ${className}`}
      style={{ width: size, height: size, fontSize: Math.round(size * (initials.length > 2 ? 0.3 : 0.38)) }}
    >
      {initials}
    </div>
  );
}
