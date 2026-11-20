/** WhatsApp message kinds, their built-in wording and the placeholders they can use (safe for client code). */

export type WaKind =
  | "INVOICE"
  | "PAYMENT_DUE"
  | "VEHICLE_READY"
  | "SERVICE_DUE"
  | "WARRANTY"
  | "BIRTHDAY"
  | "FEEDBACK"
  | "WIN_BACK"
  | "GENERAL"
  | "OFFER";

export const WA_KINDS: { key: WaKind; label: string; hint: string }[] = [
  { key: "INVOICE", label: "Bill / invoice", hint: "Sent from POS or an invoice page" },
  { key: "PAYMENT_DUE", label: "Payment reminder", hint: "Customer has dues" },
  { key: "VEHICLE_READY", label: "Vehicle ready", hint: "Job card completed" },
  { key: "SERVICE_DUE", label: "Service due", hint: "Next service / check-up" },
  { key: "WARRANTY", label: "Warranty ending", hint: "A product's warranty ends soon" },
  { key: "BIRTHDAY", label: "Birthday wish", hint: "Customer's birthday" },
  { key: "FEEDBACK", label: "Thank you & feedback", hint: "A few days after a bill" },
  { key: "WIN_BACK", label: "We miss you", hint: "Customer has not visited for a while" },
  { key: "GENERAL", label: "General greeting", hint: "Start a chat and type the rest in WhatsApp" },
  { key: "OFFER", label: "Offer (default text)", hint: "Starting text for a new offer broadcast" },
];

export const WA_LABEL = Object.fromEntries(WA_KINDS.map((k) => [k.key, k.label])) as Record<WaKind, string>;

export const WA_DEFAULTS: Record<WaKind, string> = {
  INVOICE:
    "Hello {customer},\nThank you for shopping at *{shop}*!\n\n*Bill {invoice}* · {date}\n{items}\n\n*Total: {total}*\nPaid: {paid}{due_line}{upi_line}\n\n{footer}",
  PAYMENT_DUE:
    "Hello {customer}, this is a friendly reminder from *{shop}*: *{due}* is pending on your account.{upi_line}\nPlease ignore this if you have already paid. Thank you!",
  VEHICLE_READY: "Hello {customer}, your *{vehicle}* is ready for pickup at *{shop}* ({job}). See you soon!",
  SERVICE_DUE:
    "Hello {customer}, it's time for the next check-up of your *{vehicle}*. Visit *{shop}* this week – call {shop_phone} to book a slot.",
  WARRANTY:
    "Hello {customer}, the warranty on your *{item}* from *{shop}* ends soon. If you notice any issue, visit us before it ends – or ask us about a replacement offer.",
  BIRTHDAY: "Happy birthday, {customer}! Wishing you a wonderful year ahead from all of us at *{shop}*.",
  FEEDBACK:
    "Hello {customer}, thank you for your purchase at *{shop}* (bill {invoice}). How is everything working? Just reply here – your feedback helps us serve you better.",
  WIN_BACK: "Hello {customer}, we miss you at *{shop}*! New accessories have arrived for your {vehicle}. Drop in this week – we would love to see you.",
  GENERAL: "Hello {customer}, greetings from *{shop}*!",
  OFFER: "Hello {customer}! *{shop}* special offer for you:\n\n[write the offer here]\n\nValid till [date]. Reply STOP if you do not want offers.",
};

export const WA_PLACEHOLDERS: [string, string][] = [
  ["{customer}", "Customer's name"],
  ["{shop}", "Shop name"],
  ["{shop_phone}", "Shop phone"],
  ["{invoice}", "Bill number"],
  ["{date}", "Bill date"],
  ["{items}", "Bill items, one per line"],
  ["{total}", "Bill total"],
  ["{paid}", "Amount paid"],
  ["{due}", "Amount due"],
  ["{due_line}", "“Balance due: ₹…” line, only when something is due"],
  ["{upi_line}", "“Pay by UPI: …” line, only when something is due and a UPI ID is set"],
  ["{vehicle}", "Customer's vehicle"],
  ["{job}", "Job card number"],
  ["{item}", "Product name (warranty)"],
  ["{footer}", "Invoice footer from Settings"],
];

/** Digits-only international number for WhatsApp, e.g. 9876543210 → 919876543210. */
export function waPhone(raw: string | null | undefined, countryCode = "91"): string | null {
  if (!raw) return null;
  let d = raw.replace(/\D/g, "");
  if (d.startsWith("00")) d = d.slice(2);
  if (d.length === 11 && d.startsWith("0")) d = d.slice(1);
  if (d.length === 10) d = countryCode + d;
  return d.length >= 11 && d.length <= 15 ? d : null;
}

/** Link that opens WhatsApp with the chat and message ready. */
export function waUrl(phone: string, text: string, mode: string) {
  const q = `phone=${phone}&text=${encodeURIComponent(text)}`;
  if (mode === "WEB") return `https://web.whatsapp.com/send?${q}`;
  if (mode === "LINK") return `https://wa.me/${phone}?text=${encodeURIComponent(text)}`;
  return `whatsapp://send?${q}`; // WhatsApp Desktop on Windows, or the WhatsApp app on a phone
}

/** Picks the right message for a follow-up task. */
export function kindForFollowUp(type: string, refType?: string | null): WaKind {
  switch (type) {
    case "PAYMENT": return "PAYMENT_DUE";
    case "SERVICE_DUE": return "SERVICE_DUE";
    case "WARRANTY": return "WARRANTY";
    case "BIRTHDAY": return "BIRTHDAY";
    case "FEEDBACK": return "FEEDBACK";
    case "WIN_BACK": return "WIN_BACK";
    case "CALL": return refType === "JobCard" ? "VEHICLE_READY" : "GENERAL";
    default: return "GENERAL";
  }
}
