"use server";

import { revalidatePath } from "next/cache";
import { db } from "@/lib/db";
import { requireAction } from "@/lib/auth";
import { parseDay, round2 } from "@/lib/format";
import { cashSummary } from "@/lib/cash";
import { audit, errMsg, num, optStr, str, type ActionResult } from "@/lib/server-utils";

export async function addExpense(_: ActionResult, fd: FormData): Promise<ActionResult> {
  try {
    const s = await requireAction("expenses");
    const amount = num(fd, "amount");
    const category = str(fd, "category");
    if (amount <= 0 || !category) return { error: "Enter category and amount." };
    const e = await db.expense.create({
      data: { date: parseDay(str(fd, "date")), category, amount, method: str(fd, "method") || "CASH", paidTo: optStr(fd, "paidTo"), note: optStr(fd, "note"), userId: s.uid },
    });
    await audit(s.uid, "EXPENSE_ADDED", "Expense", e.id, `${category} ${amount}`);
    revalidatePath("/expenses");
    return { ok: "Expense saved." };
  } catch (e) {
    return { error: errMsg(e) };
  }
}

export async function deleteExpense(fd: FormData) {
  const s = await requireAction("expenses");
  if (!["OWNER", "MANAGER"].includes(s.role)) throw new Error("Not allowed.");
  const id = Number(fd.get("id"));
  await db.expense.delete({ where: { id } });
  await audit(s.uid, "EXPENSE_DELETED", "Expense", id);
  revalidatePath("/expenses");
}

export async function closeDay(_: ActionResult, fd: FormData): Promise<ActionResult> {
  try {
    const s = await requireAction("expenses");
    const date = str(fd, "date");
    const counted = num(fd, "counted");
    const sum = await cashSummary(date);
    await db.dayClose.upsert({
      where: { date },
      create: { date, openingCash: sum.opening, cashIn: sum.cashIn, cashOut: sum.cashOut, expected: sum.expected, counted, difference: round2(counted - sum.expected), note: optStr(fd, "note"), closedById: s.uid },
      update: { openingCash: sum.opening, cashIn: sum.cashIn, cashOut: sum.cashOut, expected: sum.expected, counted, difference: round2(counted - sum.expected), note: optStr(fd, "note"), closedById: s.uid },
    });
    await audit(s.uid, "DAY_CLOSED", "DayClose", date, `counted ${counted}, expected ${sum.expected}`);
    revalidatePath("/expenses/cashbook");
    const diff = round2(counted - sum.expected);
    return { ok: diff === 0 ? "Day closed. Cash matches exactly." : `Day closed. Difference: ${diff > 0 ? "+" : ""}${diff.toFixed(2)}` };
  } catch (e) {
    return { error: errMsg(e) };
  }
}
