export const round2 = (n: number) => Math.round((n + Number.EPSILON) * 100) / 100;

const inr = new Intl.NumberFormat("en-IN", { style: "currency", currency: "INR", maximumFractionDigits: 2, minimumFractionDigits: 2 });
const inr0 = new Intl.NumberFormat("en-IN", { style: "currency", currency: "INR", maximumFractionDigits: 0 });
const num = new Intl.NumberFormat("en-IN", { maximumFractionDigits: 2 });

export const money = (n: number | null | undefined) => inr.format(n ?? 0);
export const money0 = (n: number | null | undefined) => inr0.format(n ?? 0);
export const qty = (n: number | null | undefined) => num.format(n ?? 0);

const TZ = "Asia/Kolkata";
export const fmtDate = (d: Date | string | null | undefined) =>
  d ? new Date(d).toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric", timeZone: TZ }) : "—";
export const fmtDateTime = (d: Date | string | null | undefined) =>
  d ? new Date(d).toLocaleString("en-IN", { day: "2-digit", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit", timeZone: TZ }) : "—";

/** YYYY-MM-DD in the shop's time zone (IST). */
export function ymd(d: Date = new Date()) {
  return new Intl.DateTimeFormat("en-CA", { timeZone: TZ, year: "numeric", month: "2-digit", day: "2-digit" }).format(d);
}

/** Prisma date filter for shop-local days (IST = UTC+5:30, no DST). */
export function dayRange(from: string, to: string = from) {
  return { gte: new Date(`${from}T00:00:00+05:30`), lte: new Date(`${to}T23:59:59.999+05:30`) };
}

export function monthStart(d: Date = new Date()) {
  return ymd(d).slice(0, 8) + "01";
}

export function addDays(dateStr: string, days: number) {
  const d = new Date(`${dateStr}T12:00:00+05:30`);
  d.setUTCDate(d.getUTCDate() + days);
  return ymd(d);
}

/** Convert a YYYY-MM-DD form value to a Date at local noon (or now if empty / today). */
export function parseDay(s: string | null | undefined) {
  if (!s || s === ymd()) return new Date();
  return new Date(`${s}T12:00:00+05:30`);
}

const ONES = ["", "One", "Two", "Three", "Four", "Five", "Six", "Seven", "Eight", "Nine", "Ten", "Eleven", "Twelve", "Thirteen", "Fourteen", "Fifteen", "Sixteen", "Seventeen", "Eighteen", "Nineteen"];
const TENS = ["", "", "Twenty", "Thirty", "Forty", "Fifty", "Sixty", "Seventy", "Eighty", "Ninety"];
function two(n: number) {
  return n < 20 ? ONES[n] : TENS[Math.floor(n / 10)] + (n % 10 ? " " + ONES[n % 10] : "");
}
function three(n: number) {
  const h = Math.floor(n / 100), r = n % 100;
  return (h ? ONES[h] + " Hundred" + (r ? " " : "") : "") + (r ? two(r) : "");
}
/** Indian-system amount in words, e.g. "Rupees One Lakh Twenty Thousand Only" */
export function amountInWords(amount: number) {
  let n = Math.floor(Math.abs(amount));
  const paise = Math.round((Math.abs(amount) - n) * 100);
  if (n === 0 && paise === 0) return "Rupees Zero Only";
  const parts: string[] = [];
  const crore = Math.floor(n / 1e7); n %= 1e7;
  const lakh = Math.floor(n / 1e5); n %= 1e5;
  const thousand = Math.floor(n / 1e3); n %= 1e3;
  if (crore) parts.push(three(crore) + " Crore");
  if (lakh) parts.push(two(lakh) + " Lakh");
  if (thousand) parts.push(two(thousand) + " Thousand");
  if (n) parts.push(three(n));
  let s = "Rupees " + (parts.join(" ") || "Zero");
  if (paise) s += " and " + two(paise) + " Paise";
  return s + " Only";
}
