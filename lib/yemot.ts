/**
 * Outbound tzintuk through the Yemot campaign API.
 * The homepage at yemot.co.il does not accept these parameters; RunCampaign does.
 * Override with YEMOT_URL if the account uses another host.
 */
const CAMPAIGN_URL = "https://www.call2all.co.il/ym/api/RunCampaign";
const TEMPLATE_ID = "130645";
const FOLDER = "/3";

export type TzintukCall = {
  memberId: string;
  name: string;
  phone: string;
  status: "sent" | "failed" | "skipped";
  error?: string;
};

export function yemotPhone(value: string) {
  const digits = value.replace(/[^\d]/g, "");
  if (!digits) return "";
  if (digits.startsWith("972")) return `0${digits.slice(3)}`;
  return digits;
}

export function samePhone(a: string, b: string) {
  const left = yemotPhone(a).replace(/^0/, "");
  const right = yemotPhone(b).replace(/^0/, "");
  return left.length >= 8 && left === right;
}

export async function placeTzintuk(phones: string[]) {
  const list = [...new Set(phones.map(yemotPhone).filter((phone) => phone.length >= 9))];
  const outcome = new Map<string, { ok: boolean; error?: string }>();
  if (!list.length) return outcome;

  const token = process.env.YEMOT_TOKEN?.trim();
  if (!token) {
    for (const phone of list) outcome.set(phone, { ok: false, error: "אין אסימון ימות בשרת, הצינתוק לא יצא" });
    return outcome;
  }

  const url = new URL(process.env.YEMOT_URL?.trim() || CAMPAIGN_URL);
  url.searchParams.set("token", token);
  url.searchParams.set("templateId", TEMPLATE_ID);
  url.searchParams.set("phones", list.join(":"));
  url.searchParams.set("goToFolder", FOLDER);

  try {
    const res = await fetch(url, { method: "GET", cache: "no-store" });
    const text = await res.text();
    const error = campaignError(res.status, text);
    for (const phone of list) outcome.set(phone, error ? { ok: false, error } : { ok: true });
  } catch {
    for (const phone of list) outcome.set(phone, { ok: false, error: "לא הצלחנו להגיע לימות" });
  }
  return outcome;
}

function campaignError(status: number, text: string) {
  const flat = text.replace(/\s+/g, " ").trim();
  if (/<!doctype|<html/i.test(flat)) return "ימות לא קיבל את בקשת החיוג";
  if (status < 200 || status >= 300) return clip(field(flat, "message") || `ימות החזיר שגיאה ${status}`);
  if (/responseStatus["']?\s*[:=]\s*["']?ERROR/i.test(flat)) {
    return clip(field(flat, "message") || "ימות לא התחיל את החיוג");
  }
  return null;
}

function field(flat: string, name: string) {
  const json = new RegExp(`"${name}"\\s*:\\s*"([^"]*)"`, "i").exec(flat);
  if (json) return json[1];
  const plain = new RegExp(`(?:^|[?&\\s])${name}=([^&\\s]+)`, "i").exec(flat);
  if (!plain) return "";
  try {
    return decodeURIComponent(plain[1].replace(/\+/g, " "));
  } catch {
    return plain[1];
  }
}

function clip(value: string) {
  return value.replace(/\s+/g, " ").trim().slice(0, 160);
}
