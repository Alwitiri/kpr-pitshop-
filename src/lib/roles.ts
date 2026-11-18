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
  | "jobcards"
  | "expenses"
  | "reports"
  | "staff"
  | "settings";

const ACCESS: Record<Role, Module[] | "ALL"> = {
  OWNER: "ALL",
  MANAGER: [
    "dashboard", "pos", "sales", "products", "inventory", "purchases",
    "suppliers", "customers", "jobcards", "expenses", "reports",
  ],
  CASHIER: ["dashboard", "pos", "sales", "customers", "jobcards"],
  INVENTORY: ["dashboard", "products", "inventory", "purchases", "suppliers"],
  TECHNICIAN: ["dashboard", "jobcards"],
};

export function can(role: string, module: Module): boolean {
  const a = ACCESS[role as Role];
  if (!a) return false;
  return a === "ALL" || a.includes(module);
}

/** Who may see cost price / profit numbers. */
export function canSeeProfit(role: string) {
  return role === "OWNER" || role === "MANAGER";
}
