import { gatheringLabel } from "./format";
import { memberByPhone, normalizePhone } from "./phone";
import { setMemberRsvp } from "./rsvp-record";
import { gatheringHeld, upcomingGathering } from "./selectors";
import { readState, updateState } from "./store";
import type { AppState, IvrLog, RsvpStatus } from "./types";

export const YEMOT_TEMPLATE_ID = "130645";

// name, reuse, max, min, seconds, playback, block star, block zero, replace,
// allowed keys, repeats, empty continues, empty value, keyboard lock, confirm.
const READ_FIELDS = "SelectedResponse,,1,1,10,NO,,,,123,,Ok,None,,no";

const TZ = "Asia/Jerusalem";

function yemotLine(value: string) {
  return value
    .replace(/[=&.\-–—]/g, " ")
    .replace(/\s*[·•]\s*/g, ", ")
    .replace(/\s+,/g, ",")
    .replace(/\s+/g, " ")
    .trim();
}

function yemotStamp(iso: string) {
  const parts = new Intl.DateTimeFormat("en-GB", {
    timeZone: TZ,
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  }).formatToParts(new Date(iso));
  const day = parts.find((part) => part.type === "day")?.value ?? "";
  const month = parts.find((part) => part.type === "month")?.value ?? "";
  const year = parts.find((part) => part.type === "year")?.value ?? "";
  return `${day}/${month}/${year}`;
}

function spokenTime(iso: string) {
  const parts = new Intl.DateTimeFormat("en-GB", {
    timeZone: TZ,
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
  }).formatToParts(new Date(iso));
  const hour = parts.find((part) => part.type === "hour")?.value ?? "";
  const minute = parts.find((part) => part.type === "minute")?.value ?? "";
  return `בשעה ${hour}:${minute}`;
}

function say(parts: Array<string | { kind: "date" | "dateH"; iso: string }>) {
  return parts
    .map((part) => {
      if (typeof part !== "string") return `${part.kind}-${yemotStamp(part.iso)}`;
      const text = yemotLine(part);
      return text ? `t-${text}` : "";
    })
    .filter(Boolean)
    .join(".");
}

function readMenu(parts: Array<string | { kind: "date" | "dateH"; iso: string }>) {
  return `read=${say(parts)}=${READ_FIELDS}`;
}

function closing(text: string) {
  return `id_list_message=${say([text])}&go_to_folder=hangup`;
}

export const YEMOT_THANKS = closing("תודה רבה, בחירתכם נרשמה בהצלחה, להתראות");
export const YEMOT_UNKNOWN = closing("לא זיהינו את מספר הטלפון השמור באתר, להתראות");
export const YEMOT_CLOSED = closing("החברה הקרובה לא פתוחה להצבעה, להתראות");

function countPhrase(count: number, one: string, many: string, none: string) {
  if (count === 0) return none;
  if (count === 1) return one;
  return `${count} ${many}`;
}

function voteLines(state: AppState, event: { rsvps: Record<string, RsvpStatus> }) {
  const yes = state.members.filter((member) => event.rsvps[member.id] === "yes").length;
  const maybe = state.members.filter((member) => event.rsvps[member.id] === "maybe").length;
  const no = state.members.filter((member) => event.rsvps[member.id] === "no").length;
  const pending = state.members.filter((member) => (event.rsvps[member.id] ?? "pending") === "pending").length;
  return [
    countPhrase(yes, "חבר אחד אישר הגעה", "אישרו הגעה", "אף אחד לא אישר הגעה"),
    countPhrase(maybe, "חבר אחד ענה אולי", "ענו אולי", "אף אחד לא ענה אולי"),
    countPhrase(no, "חבר אחד לא מגיע", "לא מגיעים", "אף אחד לא ביטל"),
    countPhrase(pending, "חבר אחד טרם השיב", "טרם השיבו", "כולם כבר ענו"),
  ];
}

export function voteSummary(state: AppState, event: { rsvps: Record<string, RsvpStatus> }, status: RsvpStatus) {
  const choice = status === "yes" ? "נרשמתם כמגיע" : status === "maybe" ? "נרשמתם כאולי" : "נרשמתם כלא מגיע";
  return `id_list_message=${say([`תודה רבה, ${choice}`, ...voteLines(state, event), "להתראות"])}&go_to_folder=hangup`;
}

export function gatheringPrompt(state: AppState) {
  const event = upcomingGathering(state);
  if (!event) return closing("אין כרגע חברה קרובה ביומן, להתראות");
  const title = gatheringLabel(event);
  const parts: Array<string | { kind: "date" | "dateH"; iso: string }> = [
    "שלום",
    `החברה הבאה, ${title}`,
    { kind: "dateH", iso: event.startsAt },
    { kind: "date", iso: event.startsAt },
    spokenTime(event.startsAt),
  ];
  if (event.location?.trim()) parts.push(`במקום ${event.location}`);
  const topic = event.topic?.trim();
  if (topic && topic !== title && !title.includes(topic) && !topic.includes(title)) parts.push(`הנושא, ${topic}`);
  parts.push("הקישו 1 לאישור והגעה, 2 לאולי, או 3 לביטול");
  return readMenu(parts);
}

const KEYPAD: Record<string, RsvpStatus> = {
  "1": "yes",
  "2": "maybe",
  "3": "no",
};

export const YEMOT_TOKEN_MISSING = "בשרת אין YEMOT_TOKEN. טעינת אסימונים בימות לא שולחת צינתוק בלי הטוקן";

function yemotToken() {
  return (process.env.YEMOT_TOKEN || process.env.YEMOT_API_TOKEN || "")
    .trim()
    .replace(/^token=/i, "")
    .replace(/^["']|["']$/g, "")
    .trim();
}

function yemotCallUrl() {
  const configured = process.env.YEMOT_API_URL?.trim();
  if (!configured || /RunTzintuk\/?$/i.test(configured)) return "https://www.call2all.co.il/ym/api/RunCampaign";
  return configured.replace(/\/$/, "");
}

export function yemotConfigured() {
  return Boolean(yemotToken());
}

export type TzintukResult = {
  phone: string;
  ok: boolean;
  skipped?: boolean;
  error?: string;
};

export async function sendTzintuk(rawPhone: string): Promise<TzintukResult> {
  const phone = normalizePhone(rawPhone);
  if (!phone) return { phone: rawPhone || "", ok: false, skipped: true, error: "אין מספר טלפון" };
  const token = yemotToken();
  if (!token) return { phone, ok: false, skipped: true, error: YEMOT_TOKEN_MISSING };

  const url = new URL(yemotCallUrl());
  url.searchParams.set("token", token);
  url.searchParams.set("templateId", process.env.YEMOT_TEMPLATE_ID?.trim() || YEMOT_TEMPLATE_ID);
  url.searchParams.set("phones", phone);

  try {
    const res = await fetch(url, { method: "GET", cache: "no-store", signal: AbortSignal.timeout(15_000) });
    const text = await res.text().catch(() => "");
    const error = campaignFailure(res.status, text);
    return error ? { phone, ok: false, error } : { phone, ok: true };
  } catch {
    return { phone, ok: false, error: "לא הצלחנו להתחבר לימות" };
  }
}

function campaignFailure(status: number, text: string) {
  if (/<!doctype|<html/i.test(text)) return "ימות לא קיבלה את בקשת החיוג";
  if (status < 200 || status >= 300) return `ימות החזירה ${status}`;
  let data: { responseStatus?: string; message?: string; campaignId?: string; pending?: number } | null = null;
  try {
    data = JSON.parse(text) as { responseStatus?: string; message?: string; campaignId?: string; pending?: number };
  } catch {
    data = null;
  }
  if (!data) return yemotError(text);
  if (data.responseStatus && data.responseStatus !== "OK") return yemotError(text);
  if (!data.campaignId) return yemotError(text);
  if (typeof data.pending === "number" && data.pending < 1) return "ימות לא מצאה מספר לחיוג";
  return null;
}

function yemotError(text: string) {
  try {
    const data = JSON.parse(text) as { message?: string; responseStatus?: string };
    const message = data.message?.trim();
    if (message) return message.slice(0, 160);
  } catch {
    // plain text from the provider
  }
  const compact = text.replace(/\s+/g, " ").trim();
  return compact ? compact.slice(0, 160) : "שליחת הצינתוק נכשלה";
}

export function ymText(body: string) {
  return new Response(body, {
    headers: {
      "Content-Type": "text/plain; charset=utf-8",
      "Cache-Control": "no-store",
    },
  });
}

export async function paramsFromYemot(request: Request) {
  const params: Record<string, string> = {};
  for (const [key, value] of new URL(request.url).searchParams) {
    params[key] = value;
  }
  if (request.method === "GET" || request.method === "HEAD") return params;
  const contentType = request.headers.get("content-type") ?? "";
  try {
    if (contentType.includes("application/json")) {
      const body = (await request.json()) as Record<string, unknown>;
      for (const [key, value] of Object.entries(body)) {
        if (value == null) continue;
        params[key] = String(value);
      }
      return params;
    }
    const form = await request.formData();
    for (const [key, value] of form.entries()) {
      params[key] = String(value);
    }
  } catch {
    // Yemot still gets a hang-up line even if the body could not be parsed.
  }
  return params;
}

function lowerParams(params: Record<string, string>) {
  const out: Record<string, string> = {};
  for (const [key, value] of Object.entries(params)) out[key.toLowerCase()] = value.trim();
  return out;
}

function pick(params: Record<string, string>, keys: string[]) {
  const lower = lowerParams(params);
  for (const key of keys) {
    const value = lower[key.toLowerCase()];
    if (value) return value;
  }
  return "";
}

/** The person on the line, not the system's own number (ApiDID). */
export function callerPhone(params: Record<string, string>) {
  const lower = lowerParams(params);
  const system = new Set(
    [lower.apidid, lower.apirealdid, lower.did]
      .map((value) => normalizePhone(value ?? ""))
      .filter(Boolean)
  );
  const candidates = [
    lower.apiphone,
    lower.phone,
    lower.from,
    lower.callerid,
    lower.apicallerid,
    lower.apidestphone,
    lower.apidestination,
  ];
  for (const raw of candidates) {
    const phone = normalizePhone(raw ?? "");
    if (phone && !system.has(phone)) return raw;
  }
  return lower.apiphone || lower.phone || "";
}

export async function handleMeetingResponse(params: Record<string, string>) {
  const lower = lowerParams(params);
  if (lower.hangup === "yes" || lower.apihangup === "yes") {
    return ymText("noop=hangup");
  }

  const phone = callerPhone(params);
  const selected = pick(params, ["SelectedResponse"]);
  const status = KEYPAD[selected];

  if (!status) {
    try {
      return ymText(gatheringPrompt(await readState()));
    } catch {
      return ymText(readMenu(["שלום", "הקישו 1 לאישור הגעה, 2 לאולי, או 3 לביטול"]));
    }
  }

  const at = new Date().toISOString();
  let result = "logged";
  let memberId: string | undefined;
  let eventId: string | undefined;

  const saved = await updateState((state) => {
    const member = memberByPhone(state.members, phone);
    memberId = member?.id;
    const event = upcomingGathering(state);
    eventId = event?.id;

    if (!member) result = "unknown_phone";
    else if (!event || gatheringHeld(event) || event.status === "cancelled") result = "already_held";
    else {
      setMemberRsvp(event, member.id, status, "phone");
      result = status === "yes" ? "rsvp_yes" : status === "maybe" ? "rsvp_maybe" : "rsvp_no";
    }

    const entry: IvrLog = {
      id: crypto.randomUUID(),
      at,
      phone: normalizePhone(phone) || phone || "unknown",
      action: "meeting-response",
      memberId,
      eventId,
      result,
    };
    state.ivrLog.unshift(entry);
  });

  if (result === "unknown_phone") return ymText(YEMOT_UNKNOWN);
  if (result === "already_held") return ymText(YEMOT_CLOSED);
  const event = eventId ? saved.gatherings.find((item) => item.id === eventId) : undefined;
  if (!event || (result !== "rsvp_yes" && result !== "rsvp_maybe" && result !== "rsvp_no")) return ymText(YEMOT_THANKS);
  return ymText(voteSummary(saved, event, status));
}
