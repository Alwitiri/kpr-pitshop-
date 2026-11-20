import Link from "next/link";
import { Icon } from "./icons";

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
    <div className="page-enter mb-6 flex flex-wrap items-end justify-between gap-x-4 gap-y-3">
      <div className="min-w-0">
        {back && (
          <Link
            href={back}
            className="-ml-1 mb-1.5 inline-flex min-h-8 items-center gap-1 rounded-md px-1 text-xs font-semibold text-gray-500 transition hover:text-gray-900 no-print"
          >
            <Icon name="arrowLeft" className="h-3.5 w-3.5" /> Back
          </Link>
        )}
        <h1 className="text-[1.6rem] font-bold leading-tight tracking-tight text-gray-950 [overflow-wrap:anywhere]">{title}</h1>
        {subtitle && <div className="mt-1 text-sm text-gray-600">{subtitle}</div>}
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
    default: "text-gray-950",
    good: "text-emerald-700",
    warn: "text-amber-700",
    bad: "text-red-700",
  }[tone];
  const bar = { default: "bg-gray-200", good: "bg-emerald-500", warn: "bg-amber-500", bad: "bg-red-500" }[tone];
  const body = (
    <div className={`card relative h-full overflow-hidden p-4 ${href ? "card-link" : ""}`}>
      <span className={`absolute inset-y-0 left-0 w-1 ${bar}`} aria-hidden />
      <div className="flex items-start justify-between gap-2">
        <div className="text-xs font-semibold uppercase tracking-wide text-gray-600">{label}</div>
        {href && <Icon name="chevronRight" className="h-4 w-4 text-gray-300 transition group-hover:text-gray-500" />}
      </div>
      <div className={`mt-1.5 text-2xl font-bold leading-tight tabular-nums ${toneCls}`}>{value}</div>
      {hint && <div className="mt-1 text-xs text-gray-600">{hint}</div>}
    </div>
  );
  return href ? <Link href={href} className="group block rounded-xl">{body}</Link> : body;
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
      <span className="h-1.5 w-1.5 rounded-full bg-current opacity-60" aria-hidden />
      {children ?? status.replace(/_/g, " ").toLowerCase().replace(/^\w/, (c) => c.toUpperCase())}
    </span>
  );
}

export function Empty({ children, action, icon = "inbox" }: { children: React.ReactNode; action?: React.ReactNode; icon?: string }) {
  return (
    <div className="flex flex-col items-center gap-2 px-4 py-12 text-center">
      <span className="grid h-11 w-11 place-items-center rounded-full bg-gray-100 text-gray-400">
        <Icon name={icon} className="h-5 w-5" />
      </span>
      <div className="max-w-sm text-sm text-gray-600">{children}</div>
      {action && <div className="mt-1">{action}</div>}
    </div>
  );
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
        <div className="flex min-h-12 flex-wrap items-center justify-between gap-2 border-b border-gray-100 px-4 py-2.5 sm:px-5">
          <h2 className="text-[0.95rem] font-semibold text-gray-950">{title}</h2>
          {actions && <div className="flex items-center gap-2 no-print">{actions}</div>}
        </div>
      )}
      <div className={pad ? "card-pad" : "overflow-x-auto overscroll-x-contain"}>{children}</div>
    </section>
  );
}

export function TableWrap({ children }: { children: React.ReactNode }) {
  return <div className="overflow-x-auto overscroll-x-contain">{children}</div>;
}

/** GET search/filter form that preserves nothing else – simple and bookmarkable. */
export function FilterBar({ children }: { children: React.ReactNode }) {
  return (
    <form className="card mb-4 flex flex-wrap items-end gap-3 p-3 sm:p-4 no-print" method="get" role="search">
      {children}
      <div className="flex gap-2">
        <button className="btn-dark" type="submit"><Icon name="filter" className="h-3.5 w-3.5" />Apply</button>
        {/* "?" clears every filter but stays on this page */}
        <a href="?" className="btn-ghost" title="Clear all filters"><Icon name="reset" className="h-3.5 w-3.5" />Clear</a>
      </div>
    </form>
  );
}

export function Pager({ page, pages, base }: { page: number; pages: number; base: string }) {
  if (pages <= 1) return null;
  const sep = base.includes("?") ? "&" : "?";
  return (
    <nav className="flex items-center justify-between gap-2 border-t border-gray-100 px-4 py-3 text-sm no-print sm:px-5" aria-label="Pages">
      <span className="text-gray-600">
        Page <b className="tabular-nums">{page}</b> of <span className="tabular-nums">{pages}</span>
      </span>
      <div className="flex gap-2">
        {page > 1 ? (
          <Link className="btn-outline btn-sm" href={`${base}${sep}page=${page - 1}`} rel="prev"><Icon name="chevronLeft" className="h-3.5 w-3.5" />Previous</Link>
        ) : <span className="btn-outline btn-sm pointer-events-none opacity-40" aria-hidden><Icon name="chevronLeft" className="h-3.5 w-3.5" />Previous</span>}
        {page < pages ? (
          <Link className="btn-outline btn-sm" href={`${base}${sep}page=${page + 1}`} rel="next">Next<Icon name="chevronRight" className="h-3.5 w-3.5" /></Link>
        ) : <span className="btn-outline btn-sm pointer-events-none opacity-40" aria-hidden>Next<Icon name="chevronRight" className="h-3.5 w-3.5" /></span>}
      </div>
    </nav>
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
