import { requirePage } from "@/lib/auth";
import { can, type Module } from "@/lib/roles";
import { getSettings } from "@/lib/server-utils";
import { headers } from "next/headers";
import { recordDevice } from "@/lib/network";
import { db } from "@/lib/db";
import { dayRange, ymd } from "@/lib/format";
import { logout } from "@/actions/auth";
import { Sidebar, type NavItem } from "@/components/sidebar";
import { ScanListener } from "@/components/scan-listener";

const NAV: (NavItem & { module: Module })[] = [
  { href: "/", label: "Dashboard", icon: "dashboard", module: "dashboard", group: "" },
  { href: "/pos", label: "POS Billing", icon: "pos", module: "pos", group: "Sell" },
  { href: "/sales", label: "Sales & Invoices", icon: "sales", module: "sales", group: "Sell" },
  { href: "/jobcards", label: "Job Cards", icon: "jobcards", module: "jobcards", group: "Sell" },
  { href: "/customers", label: "Customers (CRM)", icon: "customers", module: "customers", group: "Customers" },
  { href: "/followups", label: "Follow-ups", icon: "followups", module: "followups", group: "Customers" },
  { href: "/whatsapp", label: "WhatsApp", icon: "whatsapp", module: "whatsapp", group: "Customers" },
  { href: "/products", label: "Products", icon: "products", module: "products", group: "Stock" },
  { href: "/inventory", label: "Inventory", icon: "inventory", module: "inventory", group: "Stock" },
  { href: "/purchases", label: "Purchases", icon: "purchases", module: "purchases", group: "Stock" },
  { href: "/suppliers", label: "Suppliers", icon: "suppliers", module: "suppliers", group: "Stock" },
  { href: "/expenses", label: "Expenses & Cash", icon: "expenses", module: "expenses", group: "Money" },
  { href: "/reports", label: "Reports", icon: "reports", module: "reports", group: "Money" },
  { href: "/staff", label: "Staff", icon: "staff", module: "staff", group: "Admin" },
  { href: "/settings", label: "Settings", icon: "settings", module: "settings", group: "Admin" },
];

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const s = await requirePage();
  const settings = await getSettings();
  recordDevice(await headers(), s); // Settings → Connect devices shows who is using the app
  const dueFollowUps = can(s.role, "followups")
    ? await db.followUp.count({ where: { status: "OPEN", dueDate: { lte: dayRange(ymd()).lte } } }).catch(() => 0)
    : 0;
  const waWaiting = can(s.role, "whatsapp") ? await db.waMessage.count({ where: { OR: [{ status: "QUEUED", channel: "CLICK" }, { status: "FAILED", channel: "CLOUD", createdAt: { gte: new Date(Date.now() - 14 * 864e5) } }] } }).catch(() => 0) : 0;
  const items = NAV.filter((n) => can(s.role, n.module)).map(({ href, label, icon, group }) => ({
    href, label, icon, group, badge: href === "/followups" ? dueFollowUps : href === "/whatsapp" ? waWaiting : undefined,
  }));
  return (
    <div className="min-h-screen">
      <Sidebar items={items} user={{ name: s.name, role: s.role }} logoutAction={logout} shopName={settings.shopName} logo={settings.logoFile ? `/api/logo?v=${encodeURIComponent(settings.logoFile)}` : null} />
      <ScanListener canProducts={can(s.role, "products")} canSales={can(s.role, "sales")} />
      <main id="main" tabIndex={-1} className="outline-none lg:pl-60 print:pl-0">
        <div className="mx-auto max-w-[1440px] px-4 py-5 sm:px-6 lg:px-8 lg:py-7 print:max-w-none print:p-0">{children}</div>
      </main>
    </div>
  );
}
