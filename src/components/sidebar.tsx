"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState } from "react";
import { QuickFind } from "./scan-listener";

export type NavItem = { href: string; label: string; icon: string };

const ICONS: Record<string, React.ReactNode> = {
  dashboard: <path d="M3 13h8V3H3zm0 8h8v-6H3zm10 0h8V11h-8zm0-18v6h8V3z" />,
  pos: <path d="M7 18a2 2 0 1 0 0 4 2 2 0 0 0 0-4M1 2v2h2l3.6 7.6-1.4 2.4A2 2 0 0 0 7 17h12v-2H7.4a.25.25 0 0 1-.2-.4l.9-1.6h7.4a2 2 0 0 0 1.8-1l3.6-6.5A1 1 0 0 0 20 4H5.2l-.9-2zm16 16a2 2 0 1 0 0 4 2 2 0 0 0 0-4" />,
  sales: <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8zm-1 7V3.5L18.5 9zM8 13h8v2H8zm0 4h8v2H8z" />,
  products: <path d="M21 16.5V7.5L12 2.3 3 7.5v9l9 5.2zM12 4.6l6.6 3.8L12 12.2 5.4 8.4zM5 10.1l6 3.5v6.9l-6-3.5zm8 10.4v-6.9l6-3.5v6.9z" />,
  inventory: <path d="M20 2H4a2 2 0 0 0-2 2v3a2 2 0 0 0 1 1.7V20a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V8.7A2 2 0 0 0 22 7V4a2 2 0 0 0-2-2m-5 12H9v-2h6zm5-7H4V4h16z" />,
  purchases: <path d="M19 6h-2a5 5 0 0 0-10 0H5a2 2 0 0 0-2 2v12a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V8a2 2 0 0 0-2-2m-7-3a3 3 0 0 1 3 3H9a3 3 0 0 1 3-3m0 10a5 5 0 0 1-5-5h2a3 3 0 0 0 6 0h2a5 5 0 0 1-5 5" />,
  suppliers: <path d="M20 8h-3V4H3a2 2 0 0 0-2 2v11h2a3 3 0 0 0 6 0h6a3 3 0 0 0 6 0h2v-5zM6 18.5A1.5 1.5 0 1 1 7.5 17 1.5 1.5 0 0 1 6 18.5m13.5-9 2 2.5H17V9.5zM18 18.5a1.5 1.5 0 1 1 1.5-1.5 1.5 1.5 0 0 1-1.5 1.5" />,
  customers: <path d="M16 11a3 3 0 1 0-3-3 3 3 0 0 0 3 3m-8 0a3 3 0 1 0-3-3 3 3 0 0 0 3 3m0 2c-2.3 0-7 1.2-7 3.5V19h14v-2.5C15 14.2 10.3 13 8 13m8 0h-1a4.2 4.2 0 0 1 2 3.5V19h6v-2.5c0-2.3-4.7-3.5-7-3.5" />,
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
}: {
  items: NavItem[];
  user: { name: string; role: string };
  logoutAction: () => Promise<void>;
  shopName: string;
}) {
  const path = usePathname();
  const [open, setOpen] = useState(false);
  const isActive = (href: string) => (href === "/" ? path === "/" : path === href || path.startsWith(href + "/"));

  return (
    <>
      {/* Mobile top bar */}
      <div className="sticky top-0 z-30 flex items-center justify-between bg-gray-950 px-4 py-3 text-white lg:hidden no-print">
        <button onClick={() => setOpen(true)} className="rounded p-1 hover:bg-white/10" aria-label="Open menu">
          <svg viewBox="0 0 24 24" className="h-6 w-6 fill-current"><path d="M3 6h18v2H3zm0 5h18v2H3zm0 5h18v2H3z" /></svg>
        </button>
        <span className="font-bold">{shopName}</span>
        <span className="w-6" />
      </div>
      {open && <div className="fixed inset-0 z-40 bg-black/50 lg:hidden" onClick={() => setOpen(false)} />}
      <aside
        className={`no-print fixed inset-y-0 left-0 z-50 flex w-60 flex-col bg-gray-950 text-gray-300 transition-transform lg:translate-x-0 ${
          open ? "translate-x-0" : "-translate-x-full"
        }`}
      >
        <div className="flex items-center gap-2.5 px-4 py-4">
          <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-brand-600 text-xs font-black text-white">KPR</div>
          <div className="min-w-0">
            <div className="truncate text-sm font-bold text-white">{shopName}</div>
            <div className="text-[11px] text-gray-500">Business Manager</div>
          </div>
        </div>
        <QuickFind />
        <nav className="flex-1 space-y-0.5 overflow-y-auto px-2 py-2">
          {items.map((it) => (
            <Link
              key={it.href}
              href={it.href}
              onClick={() => setOpen(false)}
              className={`flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition ${
                isActive(it.href) ? "bg-brand-600 text-white" : "hover:bg-white/5 hover:text-white"
              }`}
            >
              <svg viewBox="0 0 24 24" className="h-[18px] w-[18px] shrink-0 fill-current">{ICONS[it.icon]}</svg>
              {it.label}
            </Link>
          ))}
        </nav>
        <div className="border-t border-white/10 p-3">
          <Link href="/account" className="block rounded-lg px-2 py-1.5 hover:bg-white/5" onClick={() => setOpen(false)}>
            <div className="truncate text-sm font-semibold text-white">{user.name}</div>
            <div className="text-xs text-gray-500">{user.role.toLowerCase()}</div>
          </Link>
          <form action={logoutAction}>
            <button className="mt-1 w-full rounded-lg px-2 py-1.5 text-left text-sm text-gray-400 hover:bg-white/5 hover:text-white">
              Log out
            </button>
          </form>
        </div>
      </aside>
    </>
  );
}
