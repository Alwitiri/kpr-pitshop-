import Link from "next/link";

export function PageHeader({
  title,
  subtitle,
  actions,
  back,
}: {
  title: React.ReactNode;
  subtitle?: React.ReactNode;
  actions?: React.ReactNode;
  back?: string;
}) {
  return (
    <div className="mb-5 flex flex-wrap items-end justify-between gap-3">
      <div className="min-w-0">
        {back && (
          <Link href={back} className="mb-1 inline-block text-xs font-medium text-gray-500 hover:text-gray-800">
            ← Back
          </Link>
        )}
        <h1 className="truncate text-2xl font-bold tracking-tight text-gray-900">{title}</h1>
        {subtitle && <p className="mt-0.5 text-sm text-gray-500">{subtitle}</p>}
      </div>
      {actions && <div className="flex flex-wrap items-center gap-2 no-print">{actions}</div>}
    </div>
  );
}

export function Stat({
  label,
  value,
  hint,
  tone = "default",
  href,
}: {
  label: string;
  value: React.ReactNode;
  hint?: React.ReactNode;
  tone?: "default" | "good" | "warn" | "bad";
  href?: string;
}) {
  const toneCls = {
    default: "text-gray-900",
    good: "text-emerald-600",
    warn: "text-amber-600",
    bad: "text-red-600",
  }[tone];
  const body = (
    <div className="card card-pad h-full transition hover:shadow-md">
      <div className="text-xs font-semibold uppercase tracking-wide text-gray-500">{label}</div>
      <div className={`mt-1 text-2xl font-bold tabular-nums ${toneCls}`}>{value}</div>
      {hint && <div className="mt-0.5 text-xs text-gray-500">{hint}</div>}
    </div>
  );
  return href ? <Link href={href}>{body}</Link> : body;
}

const BADGE: Record<string, string> = {
  PAID: "bg-emerald-50 text-emerald-700",
  PARTIAL: "bg-amber-50 text-amber-700",
  UNPAID: "bg-red-50 text-red-700",
  CANCELLED: "bg-gray-100 text-gray-500 line-through",
  RECEIVED: "bg-sky-50 text-sky-700",
  INSPECTION: "bg-violet-50 text-violet-700",
  IN_PROGRESS: "bg-amber-50 text-amber-700",
  COMPLETED: "bg-emerald-50 text-emerald-700",
  DELIVERED: "bg-gray-100 text-gray-700",
  LOW: "bg-amber-50 text-amber-700",
  OUT: "bg-red-50 text-red-700",
  OK: "bg-emerald-50 text-emerald-700",
  ACTIVE: "bg-emerald-50 text-emerald-700",
  INACTIVE: "bg-gray-100 text-gray-500",
  PRESENT: "bg-emerald-50 text-emerald-700",
  ABSENT: "bg-red-50 text-red-700",
  HALF_DAY: "bg-amber-50 text-amber-700",
  LEAVE: "bg-sky-50 text-sky-700",
};

export function Badge({ status, children }: { status: string; children?: React.ReactNode }) {
  return (
    <span className={`badge ${BADGE[status] ?? "bg-gray-100 text-gray-700"}`}>
      {children ?? status.replace(/_/g, " ").toLowerCase().replace(/^\w/, (c) => c.toUpperCase())}
    </span>
  );
}

export function Empty({ children }: { children: React.ReactNode }) {
  return <div className="px-4 py-10 text-center text-sm text-gray-500">{children}</div>;
}

export function Field({
  label,
  children,
  className = "",
  hint,
}: {
  label: string;
  children: React.ReactNode;
  className?: string;
  hint?: string;
}) {
  return (
    <label className={`block ${className}`}>
      <span className="label">{label}</span>
      {children}
      {hint && <span className="mt-1 block text-xs text-gray-400">{hint}</span>}
    </label>
  );
}

export function Section({
  title,
  actions,
  children,
  className = "",
  pad = true,
}: {
  title?: React.ReactNode;
  actions?: React.ReactNode;
  children: React.ReactNode;
  className?: string;
  pad?: boolean;
}) {
  return (
    <section className={`card ${className}`}>
      {(title || actions) && (
        <div className="flex items-center justify-between gap-2 border-b border-gray-100 px-4 py-3 sm:px-5">
          <h2 className="text-sm font-semibold text-gray-900">{title}</h2>
          {actions && <div className="flex items-center gap-2 no-print">{actions}</div>}
        </div>
      )}
      <div className={pad ? "card-pad" : ""}>{children}</div>
    </section>
  );
}

export function TableWrap({ children }: { children: React.ReactNode }) {
  return <div className="overflow-x-auto">{children}</div>;
}

/** GET search/filter form that preserves nothing else – simple and bookmarkable. */
export function FilterBar({ children }: { children: React.ReactNode }) {
  return (
    <form className="card mb-4 flex flex-wrap items-end gap-3 p-3 no-print" method="get">
      {children}
      <button className="btn-dark" type="submit">Apply</button>
    </form>
  );
}

export function Pager({ page, pages, base }: { page: number; pages: number; base: string }) {
  if (pages <= 1) return null;
  const sep = base.includes("?") ? "&" : "?";
  return (
    <div className="flex items-center justify-end gap-2 border-t border-gray-100 px-4 py-3 text-sm no-print">
      <span className="text-gray-500">
        Page {page} of {pages}
      </span>
      {page > 1 && (
        <Link className="btn-outline btn-sm" href={`${base}${sep}page=${page - 1}`}>
          Prev
        </Link>
      )}
      {page < pages && (
        <Link className="btn-outline btn-sm" href={`${base}${sep}page=${page + 1}`}>
          Next
        </Link>
      )}
    </div>
  );
}

/** Build a query string from search params, overriding some keys. */
export function qs(sp: Record<string, string | string[] | undefined>, override: Record<string, string | undefined> = {}) {
  const u = new URLSearchParams();
  for (const [k, v] of Object.entries({ ...sp, ...override })) {
    if (k === "page") continue;
    if (typeof v === "string" && v !== "") u.set(k, v);
  }
  const s = u.toString();
  return s ? `?${s}` : "";
}
