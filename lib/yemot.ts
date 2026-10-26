import { gatheringHeld, upcomingGathering } from "./selectors";
import { memberByPhone, normalizePhone } from "./phone";
import { updateState } from "./store";
import type { IvrLog, RsvpStatus } from "./types";

export const YEMOT_TEMPLATE_ID = "130645";
export const YEMOT_GOTO_FOLDER = "/3";

export const YEMOT_PROMPT =
  "read=t-שלום לכם. להזמנה למפגש הבא: הקישו 1 לאישור והגעה, 2 לאולי, או 3 לביטול.=digits,1,1,1,SelectedResponse,no,no,1,7";

export const YEMOT_THANKS =
  "read=t-תודה רבה, בחירתכם נרשמה בהצלחה. להתראות.=no&hangup=yes";

export const YEMOT_UNKNOWN =
  "read=t-לא זיהינו את מספר הטלפון השמור באתר. להתראות.=no&hangup=yes";

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
  const phone = callerPhone(params);
  const selected = pick(params, ["SelectedResponse", "digits", "Digits", "ApiDigits"]);

  if (!selected) return ymText(YEMOT_PROMPT);

  const status = KEYPAD[selected];
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
    else if (!status) result = "invalid_choice";
    else {
      event.rsvps[member.id] = status;
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

  return ymText(result === "unknown_phone" ? YEMOT_UNKNOWN : YEMOT_THANKS);
}
