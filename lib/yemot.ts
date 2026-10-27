import { gatheringLabel } from "./format";
import { memberByPhone, normalizePhone } from "./phone";
import { setMemberRsvp } from "./rsvp-record";
import { gatheringHeld, upcomingGathering } from "./selectors";
import { readState, updateState } from "./store";
import type { AppState, IvrLog, RsvpStatus } from "./types";

export const YEMOT_TEMPLATE_ID = "130645";
export const YEMOT_GOTO_FOLDER = "/3";

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

function say(parts: string[]) {
  return parts
    .map(yemotLine)
    .filter(Boolean)
    .map((part) => `t-${part}`)
    .join(".");
}

function readMenu(parts: string[]) {
  return `read=${say(parts)}=${READ_FIELDS}`;
}

function closing(text: string) {
  return `id_list_message=${say([text])}&go_to_folder=hangup`;
}

export const YEMOT_THANKS = closing("תודה רבה, בחירתכם נרשמה בהצלחה, להתראות");
export const YEMOT_UNKNOWN = closing("לא זיהינו את מספר הטלפון השמור באתר, להתראות");
export const YEMOT_CLOSED = closing("החברה הקרובה לא פתוחה להצבעה, להתראות");

function jerusalemWhen(iso: string) {
  const date = new Date(iso);
  const pick = (options: Intl.DateTimeFormatOptions) =>
    new Intl.DateTimeFormat("he-IL", { timeZone: TZ, ...options }).format(date);
  return {
    weekday: pick({ weekday: "long" }),
    day: pick({ day: "numeric" }),
    month: pick({ month: "long" }),
    time: pick({ hour: "2-digit", minute: "2-digit", hour12: false }),
  };
}

function countPhrase(count: number, one: string, many: string, none: string) {
  if (count === 0) return none;
  if (count === 1) return one;
  return `${count} ${many}`;
}

export function gatheringPrompt(state: AppState) {
  const event = upcomingGathering(state);
  if (!event) return closing("אין כרגע חברה קרובה ביומן, להתראות");
  const when = jerusalemWhen(event.startsAt);
  const yes = state.members.filter((member) => event.rsvps[member.id] === "yes").length;
  const maybe = state.members.filter((member) => event.rsvps[member.id] === "maybe").length;
  const no = state.members.filter((member) => event.rsvps[member.id] === "no").length;
  const pending = state.members.filter((member) => (event.rsvps[member.id] ?? "pending") === "pending").length;
  const title = gatheringLabel(event);
  const parts = [
    "שלום",
    `החברה הבאה, ${title}, תתקיים ב${when.weekday}, ${when.day} ב${when.month}, בשעה ${when.time}`,
  ];
  if (event.location?.trim()) parts.push(`במקום ${event.location}`);
  const topic = event.topic?.trim();
  if (topic && topic !== title && !title.includes(topic) && !topic.includes(title)) parts.push(`הנושא, ${topic}`);
  parts.push(
    countPhrase(yes, "חבר אחד כבר אישר הגעה", "כבר אישרו הגעה", "עדיין אף אחד לא אישר הגעה"),
    countPhrase(maybe, "חבר אחד ענה אולי", "ענו אולי", "אף אחד לא ענה אולי"),
    countPhrase(no, "חבר אחד לא מגיע", "לא מגיעים", "אף אחד לא ביטל"),
    countPhrase(pending, "חבר אחד טרם השיב", "טרם השיבו", "כולם כבר ענו"),
    "הקישו 1 לאישור והגעה, 2 לאולי, או 3 לביטול",
  );
  return readMenu(parts);
}

const KEYPAD: Record<string, RsvpStatus> = {
  "1": "yes",
  "2": "maybe",
  "3": "no",
};

function yemotToken() {
  return (process.env.YEMOT_TOKEN || process.env.YEMOT_API_TOKEN || "").trim();
}

function yemotCallUrl() {
  return (process.env.YEMOT_API_URL || "https://www.call2all.co.il/ym/api/RunTzintuk").replace(/\/$/, "");
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
  if (!token) return { phone, ok: false, skipped: true, error: "אין אסימון ימות בשרת" };

  const url = new URL(yemotCallUrl());
  url.searchParams.set("token", token);
  url.searchParams.set("templateId", process.env.YEMOT_TEMPLATE_ID?.trim() || YEMOT_TEMPLATE_ID);
  url.searchParams.set("phones", phone);
  url.searchParams.set("goToFolder", process.env.YEMOT_GOTO_FOLDER?.trim() || YEMOT_GOTO_FOLDER);

  try {
    const res = await fetch(url, { method: "GET", cache: "no-store", signal: AbortSignal.timeout(15_000) });
    const text = await res.text().catch(() => "");
    if (!res.ok) return { phone, ok: false, error: `ימות החזירה ${res.status}` };
    if (/<html/i.test(text)) return { phone, ok: false, error: "ימות לא קיבלה את בקשת החיוג" };
    try {
      const data = JSON.parse(text) as { responseStatus?: string };
      if (data.responseStatus && data.responseStatus !== "OK") {
        return { phone, ok: false, error: yemotError(text) };
      }
    } catch {
      // Yemot sometimes answers with an empty body on a successful dial.
    }
    return { phone, ok: true };
  } catch {
    return { phone, ok: false, error: "לא הצלחנו להתחבר לימות" };
  }
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

  await updateState((state) => {
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
  return ymText(YEMOT_THANKS);
}
