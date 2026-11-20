export const ROLES = ["OWNER", "MANAGER", "CASHIER", "INVENTORY", "TECHNICIAN"] as const;
export type Role = (typeof ROLES)[number];

export const ROLE_LABEL: Record<string, string> = {
  OWNER: "Owner",
  MANAGER: "Manager",
  CASHIER: "Cashier",
  INVENTORY: "Inventory Staff",
  TECHNICIAN: "Technician",
};

export type Module =
  | "dashboard"
  | "pos"
  | "sales"
  | "products"
  | "inventory"
  | "purchases"
  | "suppliers"
  | "customers"
  | "followups"
  | "jobcards"
  | "expenses"
  | "reports"
  | "staff"
  | "settings";

/** Extra abilities inside a screen, switched on/off per role like modules. */
export type Ability = "profit" | "editPrice" | "manageSales" | "deleteExpense" | "importData";

export type Perm = Module | Ability;

/** Every permission the owner can switch on or off, grouped for the Permissions screen. */
export const PERM_GROUPS: { title: string; perms: [Perm, string, string][] }[] = [
  {
    title: "Screens",
    perms: [
      ["dashboard", "Dashboard", "Home screen with today's numbers"],
      ["pos", "POS billing", "Create bills"],
      ["sales", "Sales & invoices", "View bills, take payments, returns"],
      ["customers", "Customers (CRM)", "Customer profiles, vehicles, dues"],
      ["followups", "Follow-ups", "Call list and customer reminders"],
      ["jobcards", "Job cards", "Service / installation jobs"],
      ["products", "Products", "Catalogue, prices, barcodes"],
      ["inventory", "Inventory", "Stock levels, adjustments, stock check"],
      ["purchases", "Purchases", "Supplier bills and purchase returns"],
      ["suppliers", "Suppliers", "Supplier list and payments"],
      ["expenses", "Expenses & cash", "Expenses, cash book, day close"],
      ["reports", "Reports & analytics", "All reports and customer insights"],
      ["staff", "Staff", "Logins, attendance, activity log"],
      ["settings", "Settings", "Shop details, workflows, backups"],
    ],
  },
  {
    title: "Abilities",
    perms: [
      ["profit", "See cost & profit", "Purchase price, margins and profit figures"],
      ["editPrice", "Change price at billing", "Edit the selling price on the POS screen"],
      ["manageSales", "Cancel bills", "Cancel a bill and reverse its stock"],
      ["deleteExpense", "Delete expenses", "Remove an expense entry"],
      ["importData", "Import from Excel", "Bulk import products and customers"],
    ],
  },
];

export const ALL_PERMS: Perm[] = PERM_GROUPS.flatMap((g) => g.perms.map((p) => p[0]));

/** Factory defaults. The owner can change these in Staff → Permissions. */
export const DEFAULT_PERMS: Record<Exclude<Role, "OWNER">, Perm[]> = {
  MANAGER: [
    "dashboard", "pos", "sales", "products", "inventory", "purchases", "suppliers", "customers", "followups",
    "jobcards", "expenses", "reports", "profit", "editPrice", "manageSales", "deleteExpense", "importData",
  ],
  CASHIER: ["dashboard", "pos", "sales", "customers", "followups", "jobcards"],
  INVENTORY: ["dashboard", "products", "inventory", "purchases", "suppliers"],
  TECHNICIAN: ["dashboard", "jobcards"],
};

// Permissions saved by the owner, loaded from the database by lib/permissions.ts.
// Kept on globalThis so every server bundle in the process sees the same copy.
const store = globalThis as unknown as { __kprPerms?: Record<string, Perm[]> };

export function setPermissionOverrides(map: Record<string, Perm[]>) {
  store.__kprPerms = map;
}

export function permsFor(role: string): Perm[] {
  if (role === "OWNER") return ALL_PERMS;
  return store.__kprPerms?.[role] ?? DEFAULT_PERMS[role as Exclude<Role, "OWNER">] ?? [];
}

/** The owner can always do everything, so nobody can lock the shop out. */
export function can(role: string, perm: Perm): boolean {
  if (role === "OWNER") return true;
  return permsFor(role).includes(perm);
}

/** Who may see cost price / profit numbers. */
export function canSeeProfit(role: string) {
  return can(role, "profit");
}
