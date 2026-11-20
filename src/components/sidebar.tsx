"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import { QuickFind } from "./scan-listener";
import { BrandMark } from "./brand";
import { InternetStatus, InternetWatcher } from "./internet-status";

export type NavItem = { href: string; label: string; icon: string; badge?: number; group?: string };

const ICONS: Record<string, React.ReactNode> = {
  dashboard: <path d="M3 13h8V3H3zm0 8h8v-6H3zm10 0h8V11h-8zm0-18v6h8V3z" />,
  pos: <path d="M7 18a2 2 0 1 0 0 4 2 2 0 0 0 0-4M1 2v2h2l3.6 7.6-1.4 2.4A2 2 0 0 0 7 17h12v-2H7.4a.25.25 0 0 1-.2-.4l.9-1.6h7.4a2 2 0 0 0 1.8-1l3.6-6.5A1 1 0 0 0 20 4H5.2l-.9-2zm16 16a2 2 0 1 0 0 4 2 2 0 0 0 0-4" />,
  sales: <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8zm-1 7V3.5L18.5 9zM8 13h8v2H8zm0 4h8v2H8z" />,
  products: <path d="M21 16.5V7.5L12 2.3 3 7.5v9l9 5.2zM12 4.6l6.6 3.8L12 12.2 5.4 8.4zM5 10.1l6 3.5v6.9l-6-3.5zm8 10.4v-6.9l6-3.5v6.9z" />,
  inventory: <path d="M20 2H4a2 2 0 0 0-2 2v3a2 2 0 0 0 1 1.7V20a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V8.7A2 2 0 0 0 22 7V4a2 2 0 0 0-2-2m-5 12H9v-2h6zm5-7H4V4h16z" />,
  purchases: <path d="M19 6h-2a5 5 0 0 0-10 0H5a2 2 0 0 0-2 2v12a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V8a2 2 0 0 0-2-2m-7-3a3 3 0 0 1 3 3H9a3 3 0 0 1 3-3m0 10a5 5 0 0 1-5-5h2a3 3 0 0 0 6 0h2a5 5 0 0 1-5 5" />,
  suppliers: <path d="M20 8h-3V4H3a2 2 0 0 0-2 2v11h2a3 3 0 0 0 6 0h6a3 3 0 0 0 6 0h2v-5zM6 18.5A1.5 1.5 0 1 1 7.5 17 1.5 1.5 0 0 1 6 18.5m13.5-9 2 2.5H17V9.5zM18 18.5a1.5 1.5 0 1 1 1.5-1.5 1.5 1.5 0 0 1-1.5 1.5" />,
  customers: <path d="M16 11a3 3 0 1 0-3-3 3 3 0 0 0 3 3m-8 0a3 3 0 1 0-3-3 3 3 0 0 0 3 3m0 2c-2.3 0-7 1.2-7 3.5V19h14v-2.5C15 14.2 10.3 13 8 13m8 0h-1a4.2 4.2 0 0 1 2 3.5V19h6v-2.5c0-2.3-4.7-3.5-7-3.5" />,
  followups: <path d="M19 3h-1V1h-2v2H8V1H6v2H5a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V5a2 2 0 0 0-2-2m0 16H5V8h14zm-8.5-2.5-3.5-3.5 1.4-1.4 2.1 2.1 4.6-4.6 1.4 1.4z" />,
  whatsapp: <path d="M17.5 14.4c-.3-.1-1.8-.9-2-1-.3-.1-.5-.1-.7.1-.2.3-.8 1-.9 1.2-.2.2-.3.2-.6.1a8.2 8.2 0 0 1-4-3.5c-.3-.5.3-.5.9-1.6.1-.2 0-.4 0-.5l-.9-2.2c-.2-.6-.5-.5-.7-.5h-.6a1.2 1.2 0 0 0-.9.4 3.6 3.6 0 0 0-1.1 2.7 6.3 6.3 0 0 0 1.3 3.3 14.4 14.4 0 0 0 5.5 4.9c2 .9 2.8.9 3.8.8a3.2 3.2 0 0 0 2.1-1.5 2.6 2.6 0 0 0 .2-1.5c-.1-.1-.3-.2-.6-.3M12 21.8a9.8 9.8 0 0 1-5-1.4l-.4-.2-3.7 1 1-3.6-.2-.4A9.8 9.8 0 1 1 12 21.8M20.5 3.5A11.8 11.8 0 0 0 1.9 17.7L.2 24l6.4-1.7A11.8 11.8 0 0 0 24 12a11.7 11.7 0 0 0-3.5-8.5" />,
  jobcards: <path d="M22.7 19 13.6 9.9a6.4 6.4 0 0 0-1.5-6.9A6.6 6.6 0 0 0 4.7 1.7L9 6 6 9 1.6 4.7A6.6 6.6 0 0 0 3 12.1a6.4 6.4 0 0 0 6.9 1.5l9.1 9.1a1 1 0 0 0 1.4 0l2.3-2.3a1 1 0 0 0 0-1.4" />,
  expenses: <path d="M21 18v1a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2v1h-9a2 2 0 0 0-2 2v8a2 2 0 0 0 2 2zm-9-2h10V8H12zm4-2.5a1.5 1.5 0 1 1 1.5-1.5 1.5 1.5 0 0 1-1.5 1.5" />,
  reports: <path d="M19 3H5a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V5a2 2 0 0 0-2-2M9 17H7v-7h2zm4 0h-2V7h2zm4 0h-2v-4h2z" />,
  staff: <path d="M12 12a4 4 0 1 0-4-4 4 4 0 0 0 4 4m0 2c-2.7 0-8 1.3-8 4v2h16v-2c0-2.7-5.3-4-8-4" />,
  settings: <path d="M19.1 12.9a7 7 0 0 0 0-1.8l2-1.6a.5.5 0 0 0 .1-.6l-1.9-3.3a.5.5 0 0 0-.6-.2l-2.4 1a7 7 0 0 0-1.6-.9l-.4-2.6A.5.5 0 0 0 13.9 2h-3.8a.5.5 0 0 0-.5.4l-.4 2.6a7 7 0 0 0-1.6.9l-2.4-1a.5.5 0 0 0-.6.2L2.7 8.4a.5.5 0 0 0 .1.6l2 1.6a7 7 0 0 0 0 1.8l-2 1.6a.5.5 0 0 0-.1.6l1.9 3.3a.5.5 0 0 0 .6.2l2.4-1a7 7 0 0 0 1.6.9l.4 2.6a.5.5 0 0 0 .5.4h3.8a.5.5 0 0 0 .5-.4l.4-2.6a7 7 0 0 0 1.6-.9l2.4 1a.5.5 0 0 0 .6-.2l1.9-3.3a.5.5 0 0 0-.1-.6zM12 15.5a3.5 3.5 0 1 1 3.5-3.5 3.5 3.5 0 0 1-3.5 3.5" />,
};

export function Sidebar({
  items,
  user,
  logoutAction,
  shopName,
  logo,
}: {
  items: NavItem[];
  user: { name: string; role: string };
  logoutAction: () => Promise<void>;
  shopName: string;
  logo: string | null;
}) {
  const path = usePathname();
  const [open, setOpen] = useState(false);
  const isActive = (href: string) => (href === "/" ? path === "/" : path === href || path.startsWith(href + "/"));
  const current = items.find((it) => isActive(it.href));

  // Close the mobile menu on navigation and with Escape; stop the page scrolling behind it.
  useEffect(() => setOpen(false), [path]);
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    document.addEventListener("keydown", onKey);
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = prev;
    };
  }, [open]);

  const groups: { title: string; items: NavItem[] }[] = [];
  for (const it of items) {
    const g = it.group ?? "";
    const last = groups.at(-1);
    if (last && last.title === g) last.items.push(it);
    else groups.push({ title: g, items: [it] });
  }
  const canWhatsApp = items.some((it) => it.href === "/whatsapp");
  const initials = user.name.split(/\s+/).map((w) => w[0]).join("").slice(0, 2).toUpperCase();

  return (
    <>
      <InternetWatcher />
      <a href="#main" className="sr-only z-[60] rounded-md bg-white px-3 py-2 text-sm font-semibold text-gray-900 focus:not-sr-only focus:fixed focus:left-3 focus:top-3">
        Skip to content
      </a>
      {/* Mobile top bar */}
      <div className="sticky top-0 z-30 flex h-14 items-center gap-3 border-b border-white/10 bg-gray-950 px-3 text-white lg:hidden no-print">
        <button onClick={() => setOpen(true)} className="grid h-10 w-10 place-items-center rounded-lg hover:bg-white/10" aria-label="Open menu" aria-expanded={open}>
          <svg viewBox="0 0 24 24" className="h-6 w-6 fill-current" aria-hidden><path d="M3 6h18v2H3zm0 5h18v2H3zm0 5h18v2H3z" /></svg>
        </button>
        <BrandMark logo={logo} name={shopName} size={28} />
        <div className="min-w-0 flex-1">
          <div className="truncate text-sm font-bold leading-tight">{current?.label ?? shopName}</div>
          {current && <div className="truncate text-[11px] text-gray-400">{shopName}</div>}
        </div>
        <InternetStatus compact canWhatsApp={canWhatsApp} />
      </div>
      <div
        className={`fixed inset-0 z-40 bg-black/50 transition-opacity duration-200 lg:hidden no-print ${open ? "opacity-100" : "pointer-events-none opacity-0"}`}
        onClick={() => setOpen(false)}
        aria-hidden
      />
      <aside
        className={`no-print fixed inset-y-0 left-0 z-50 flex w-64 flex-col bg-gray-950 text-gray-300 shadow-2xl transition-transform duration-200 ease-out lg:w-60 lg:translate-x-0 lg:shadow-none ${
          open ? "translate-x-0" : "-translate-x-full"
        }`}
        aria-label="Main menu"
      >
        <div className="flex items-center gap-2.5 px-4 pb-3 pt-4">
          <BrandMark logo={logo} name={shopName} size={logo ? 44 : 36} className="shrink-0" />
          <div className="min-w-0 flex-1">
            <div className="truncate text-sm font-bold text-white">{shopName}</div>
            <div className="text-[11px] text-gray-400">Business Manager</div>
          </div>
          <button onClick={() => setOpen(false)} className="grid h-9 w-9 place-items-center rounded-lg text-gray-400 hover:bg-white/10 hover:text-white lg:hidden" aria-label="Close menu">
            <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" aria-hidden><path d="M18 6 6 18M6 6l12 12" /></svg>
          </button>
        </div>
        <QuickFind />
        <nav className="flex-1 overflow-y-auto px-2 pb-3 pt-1">
          {groups.map((g, gi) => (
            <div key={gi} className={gi ? "mt-3" : ""}>
              {g.title && <div className="px-3 pb-1 text-[10px] font-semibold uppercase tracking-[0.12em] text-gray-500">{g.title}</div>}
              <div className="space-y-0.5">
                {g.items.map((it) => {
                  const active = isActive(it.href);
                  return (
                    <Link
                      key={it.href}
                      href={it.href}
                      aria-current={active ? "page" : undefined}
                      className={`group relative flex min-h-10 items-center gap-3 rounded-lg px-3 text-sm font-medium transition-colors duration-150 ${
                        active ? "bg-white/[0.08] text-white" : "text-gray-400 hover:bg-white/5 hover:text-white"
                      }`}
                    >
                      <span className={`absolute inset-y-2 left-0 w-[3px] rounded-r-full bg-brand-500 transition-opacity ${active ? "opacity-100" : "opacity-0"}`} aria-hidden />
                      <svg viewBox="0 0 24 24" className={`h-[18px] w-[18px] shrink-0 fill-current ${active ? "text-brand-500" : "text-gray-500 group-hover:text-gray-300"}`} aria-hidden>
                        {ICONS[it.icon]}
                      </svg>
                      <span className="flex-1 truncate">{it.label}</span>
                      {!!it.badge && (
                        <span className="min-w-5 rounded-full bg-amber-400 px-1.5 text-center text-[11px] font-bold leading-5 text-gray-950" aria-label={`${it.badge} due`}>
                          {it.badge > 99 ? "99+" : it.badge}
                        </span>
                      )}
                    </Link>
                  );
                })}
              </div>
            </div>
          ))}
        </nav>
        <InternetStatus canWhatsApp={canWhatsApp} />
        <div className="flex items-center gap-2 border-t border-white/10 p-3">
          <Link href="/account" className="flex min-w-0 flex-1 items-center gap-2.5 rounded-lg p-1.5 hover:bg-white/5" title="My account and password">
            <span className="grid h-8 w-8 shrink-0 place-items-center rounded-full bg-gray-800 text-xs font-bold text-white ring-1 ring-white/10">{initials}</span>
            <span className="min-w-0">
              <span className="block truncate text-sm font-semibold text-white">{user.name}</span>
              <span className="block text-[11px] capitalize text-gray-400">{user.role.toLowerCase()}</span>
            </span>
          </Link>
          <form action={logoutAction}>
            <button className="grid h-10 w-10 place-items-center rounded-lg text-gray-400 hover:bg-white/10 hover:text-white" aria-label="Log out" title="Log out">
              <svg viewBox="0 0 24 24" className="h-[18px] w-[18px]" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" aria-hidden>
                <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" />
                <path d="m16 17 5-5-5-5M21 12H9" />
              </svg>
            </button>
          </form>
        </div>
      </aside>
    </>
  );
}
