import { requirePage } from "@/lib/auth";
import { can, type Module } from "@/lib/roles";
import { getSettings } from "@/lib/server-utils";
import { logout } from "@/actions/auth";
import { Sidebar, type NavItem } from "@/components/sidebar";
import { ScanListener } from "@/components/scan-listener";

const NAV: (NavItem & { module: Module })[] = [
  { href: "/", label: "Dashboard", icon: "dashboard", module: "dashboard" },
  { href: "/pos", label: "POS Billing", icon: "pos", module: "pos" },
  { href: "/sales", label: "Sales & Invoices", icon: "sales", module: "sales" },
  { href: "/customers", label: "Customers (CRM)", icon: "customers", module: "customers" },
  { href: "/jobcards", label: "Job Cards", icon: "jobcards", module: "jobcards" },
  { href: "/products", label: "Products", icon: "products", module: "products" },
  { href: "/inventory", label: "Inventory", icon: "inventory", module: "inventory" },
  { href: "/purchases", label: "Purchases", icon: "purchases", module: "purchases" },
  { href: "/suppliers", label: "Suppliers", icon: "suppliers", module: "suppliers" },
  { href: "/expenses", label: "Expenses & Cash", icon: "expenses", module: "expenses" },
  { href: "/reports", label: "Reports", icon: "reports", module: "reports" },
  { href: "/staff", label: "Staff", icon: "staff", module: "staff" },
  { href: "/settings", label: "Settings", icon: "settings", module: "settings" },
];

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const s = await requirePage();
  const settings = await getSettings();
  const items = NAV.filter((n) => can(s.role, n.module)).map(({ href, label, icon }) => ({ href, label, icon }));
  return (
    <div className="min-h-screen">
      <Sidebar items={items} user={{ name: s.name, role: s.role }} logoutAction={logout} shopName={settings.shopName} />
      <ScanListener canProducts={can(s.role, "products")} canSales={can(s.role, "sales")} />
      <main className="lg:pl-60 print:pl-0">
        <div className="mx-auto max-w-[1400px] px-4 py-5 sm:px-6 lg:py-7 print:max-w-none print:p-0">{children}</div>
      </main>
    </div>
  );
}
