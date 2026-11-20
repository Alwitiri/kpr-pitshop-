import "server-only";
import { db } from "./db";

export type Segment = "CHAMPION" | "LOYAL" | "NEW" | "AT_RISK" | "LOST" | "OCCASIONAL" | "PROSPECT";

export const SEGMENTS: Record<Segment, { label: string; rule: string; action: string; cls: string }> = {
  CHAMPION: { label: "Champions", rule: "4+ visits, last one within 45 days", action: "Reward them – early access to new stock, loyalty discount.", cls: "bg-emerald-50 text-emerald-700" },
  LOYAL: { label: "Loyal", rule: "3+ visits, last within 4 months", action: "Suggest accessories that fit their vehicle.", cls: "bg-sky-50 text-sky-700" },
  NEW: { label: "New", rule: "First bill in the last 30 days", action: "Thank-you call; ask about the product.", cls: "bg-violet-50 text-violet-700" },
  OCCASIONAL: { label: "Occasional", rule: "Bought once or twice, still recent", action: "Service reminder or seasonal offer.", cls: "bg-gray-100 text-gray-700" },
  AT_RISK: { label: "At risk", rule: "Regular before, no visit for 2–6 months", action: "Call now with a personal offer before they go elsewhere.", cls: "bg-amber-50 text-amber-700" },
  LOST: { label: "Lost", rule: "No visit for over 6 months", action: "Win-back offer; ask why they stopped coming.", cls: "bg-red-50 text-red-700" },
  PROSPECT: { label: "No purchase yet", rule: "Saved but never billed", action: "Invite them in – they asked about something.", cls: "bg-gray-100 text-gray-500" },
};

export const SEGMENT_ORDER: Segment[] = ["CHAMPION", "LOYAL", "NEW", "OCCASIONAL", "AT_RISK", "LOST", "PROSPECT"];

export type CustStat = { visits: number; spent: number; first: Date | null; last: Date | null };

/** Recency / frequency segmentation (RFM-style, tuned for an accessories shop). */
export function segmentOf(st: CustStat | undefined, now = Date.now()): Segment {
  if (!st || !st.visits || !st.last) return "PROSPECT";
  const r = (now - st.last.getTime()) / 864e5;
  const f = st.visits;
  if (r > 180) return "LOST";
  if (f >= 4 && r <= 45) return "CHAMPION";
  if (f >= 3 && r <= 120) return "LOYAL";
  if (f === 1 && st.first && (now - st.first.getTime()) / 864e5 <= 30) return "NEW";
  if (f >= 2 && r > 60) return "AT_RISK";
  return "OCCASIONAL";
}

/** Visits, net spend, first and last bill for every customer (or the given ones). */
export async function customerStats(ids?: number[]) {
  const g = await db.sale.groupBy({
    by: ["customerId"],
    where: { customerId: ids ? { in: ids } : { not: null }, status: { not: "CANCELLED" } },
    _sum: { total: true, returnedAmount: true },
    _count: true,
    _min: { date: true },
    _max: { date: true },
  });
  return new Map<number, CustStat>(
    g
      .filter((x) => x.customerId != null)
      .map((x) => [x.customerId!, { visits: x._count, spent: (x._sum.total ?? 0) - (x._sum.returnedAmount ?? 0), first: x._min.date, last: x._max.date }]),
  );
}
