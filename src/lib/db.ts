import { PrismaClient } from "@prisma/client";

const globalForPrisma = globalThis as unknown as { prisma?: PrismaClient };

export const db = globalForPrisma.prisma ?? new PrismaClient();

if (process.env.NODE_ENV !== "production") globalForPrisma.prisma = db;

export type Tx = Omit<
  PrismaClient,
  "$connect" | "$disconnect" | "$on" | "$transaction" | "$extends"
>;

/** Case-insensitive `contains` that works on both SQLite and PostgreSQL. */
export function like(value: string) {
  const isPg = (process.env.DATABASE_URL ?? "").startsWith("postgres");
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return (isPg ? { contains: value, mode: "insensitive" } : { contains: value }) as any;
}
