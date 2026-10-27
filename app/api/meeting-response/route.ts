import { NextResponse } from "next/server";
import { gatheringLabel } from "@/lib/format";
import { readState, upcomingGathering, updateState } from "@/lib/store";
import type { AppState, Gathering, RsvpStatus } from "@/lib/types";
import { samePhone, yemotPhone } from "@/lib/yemot";

export const runtime = "nodejs";

const TZ = "Asia/Jerusalem";
// Yemot read fields: name, reuse, max, min, seconds, playback, block star, block zero,
// replace, allowed keys, repeats, empty continues, empty value, keyboard lock, confirm.
const READ_FIELDS = "SelectedResponse,,1,1,10,NO,,,,123,,Ok,None,,no";

const STATUS: Record<string, RsvpStatus> = {
  "1": "yes",
  "2": "maybe",
  "3": "no",
};

const RESULT: Record<RsvpStatus, string> = {
  yes: "מגיע",
  maybe: "אולי",
  no: "לא מגיע",
  pending: "טרם השיב",
};

function plain(body: string) {
  return new NextResponse(body, {
    headers: { "Content-Type": "text/plain; charset=utf-8", "Cache-Control": "no-store" },
  });
}

const UNDER_TWENTY = [
  "אפס", "אחת", "שתיים", "שלוש", "ארבע", "חמש", "שש", "שבע", "שמונה", "תשע",
  "עשר", "אחת עשרה", "שתים עשרה", "שלוש עשרה", "ארבע עשרה", "חמש עשרה",
  "שש עשרה", "שבע עשרה", "שמונה עשרה", "תשע עשרה",
];
const TENS = ["", "", "עשרים", "שלושים", "ארבעים", "חמישים"];

function hebrewCount(value: number) {
  if (value < 20) return UNDER_TWENTY[value] ?? "";
  const ten = Math.floor(value / 10);
  const one = value % 10;
  if (!one) return TENS[ten] ?? "";
  return `${TENS[ten]} ו${UNDER_TWENTY[one]}`;
}

function spokenClock(hour: number, minute: number) {
  const hourName = hour === 0 ? "שתים עשרה" : hebrewCount(hour);
  if (minute === 0) return `בשעה ${hourName}`;
  if (minute === 15) return `בשעה ${hourName} ורבע`;
  if (minute === 30) return `בשעה ${hourName} וחצי`;
  return `בשעה ${hourName} ו${hebrewCount(minute)}`;
}

function yemotLine(value: string) {
  return value
    .replace(/[=&.\-–—]/g, " ")
    .replace(/\s*[·•:]\s*/g, ", ")
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

const THANKS = closing("תודה רבה, בחירתכם נרשמה בהצלחה, להתראות");
const MISSED = closing("לא הצלחנו לזהות את המספר, להתראות");
const NONE = closing("שלום לכם, אין כרגע חברה קרובה להצבעה, להתראות");
const SILENT = closing("לא התקבלה הקשה, להתראות");
const UNKNOWN_KEY = closing("ההקשה לא מוכרת, להתראות");

function spokenWhen(iso: string) {
  const date = new Date(iso);
  const weekday = new Intl.DateTimeFormat("he-IL", { timeZone: TZ, weekday: "long" }).format(date);
  const clock = new Intl.DateTimeFormat("en-GB", {
    timeZone: TZ,
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
  }).formatToParts(date);
  const hour = Number(clock.find((part) => part.type === "hour")?.value);
  const minute = Number(clock.find((part) => part.type === "minute")?.value);
  const dayKey = (value: Date) => new Intl.DateTimeFormat("en-CA", { timeZone: TZ }).format(value);
  const days = Math.round((Date.parse(dayKey(date)) - Date.parse(dayKey(new Date()))) / 86_400_000);
  const when = days === 0 ? `היום ${weekday}` : days === 1 ? `מחר ${weekday}` : weekday;
  return `${when}, ${spokenClock(hour, minute)}`;
}

function gatheringPrompt(event: Gathering) {
  const title = yemotLine(gatheringLabel(event));
  const topic = yemotLine(event.topic ?? "");
  const parts = ["שלום לכם", `החברה הבאה, ${title}`];
  if (topic && topic !== title && !title.includes(topic) && !topic.includes(title)) parts.push(`הנושא, ${topic}`);
  const place = event.location?.trim() ? `, במקום ${yemotLine(event.location)}` : "";
  parts.push(`${spokenWhen(event.startsAt)}${place}`);
  parts.push("הקישו 1 לאישור והגעה, 2 לאולי, או 3 לביטול");
  return readMenu(parts);
}

async function readParams(request: Request) {
  const params: Record<string, string> = {};
  new URL(request.url).searchParams.forEach((value, key) => {
    params[key] = value;
  });
  if (request.method === "GET" || request.method === "HEAD") return params;
  const type = request.headers.get("content-type") ?? "";
  if (type.includes("application/json")) {
    const json = (await request.json().catch(() => null)) as Record<string, unknown> | null;
    if (json && typeof json === "object") {
      for (const [key, value] of Object.entries(json)) {
        if (value != null) params[key] = String(value);
      }
    }
    return params;
  }
  const text = await request.text();
  if (!text.trim()) return params;
  const form = new URLSearchParams(text);
  let sawField = false;
  form.forEach((value, key) => {
    sawField = true;
    params[key] = value;
  });
  if (!sawField && text.trim().startsWith("{")) {
    try {
      const json = JSON.parse(text) as Record<string, unknown>;
      for (const [key, value] of Object.entries(json)) {
        if (value != null) params[key] = String(value);
      }
    } catch {
      // Not a form and not JSON. The prompt still plays.
    }
  }
  return params;
}

function pick(params: Record<string, string>, names: string[]) {
  const entries = Object.entries(params);
  for (const name of names) {
    const found = entries.find(([key]) => key.toLowerCase() === name.toLowerCase());
    if (found && found[1].trim()) return found[1].trim();
  }
  return "";
}

function gatheringFor(state: AppState, phone: string) {
  const linked = state.ivrLog.find(
    (row) => row.action === "tzintuk" && row.eventId && samePhone(row.phone, phone)
  );
  const event = linked ? state.gatherings.find((item) => item.id === linked.eventId) : null;
  if (event?.status === "upcoming") return event;
  return upcomingGathering(state);
}

async function handle(request: Request) {
  const params = await readParams(request);
  if (pick(params, ["hangup"]).toLowerCase() === "yes") return plain("noop=hangup");

  const selected = pick(params, ["SelectedResponse"]);
  if (!selected) {
    const state = await readState();
    const event = upcomingGathering(state);
    return plain(event ? gatheringPrompt(event) : NONE);
  }
  if (/^(none|null)$/i.test(selected)) return plain(SILENT);

  const status = STATUS[selected];
  const phone = yemotPhone(pick(params, ["ApiPhone", "phone", "Phone"]));
  if (!phone) return plain(MISSED);
  if (!status) return plain(UNKNOWN_KEY);

  const outcome = { value: "unknown" as "saved" | "unknown" | "none" };
  try {
    await updateState((state) => {
      const member = state.members.find((item) => samePhone(item.phone, phone));
      const event = gatheringFor(state, phone);
      if (!member || !event || event.status !== "upcoming") {
        outcome.value = member ? "none" : "unknown";
        state.ivrLog.unshift({
          id: crypto.randomUUID(),
          at: new Date().toISOString(),
          phone,
          action: "meeting-response",
          memberId: member?.id,
          eventId: event?.id,
          result: member ? "אין חברה קרובה" : "מספר לא מוכר",
        });
        state.ivrLog = state.ivrLog.slice(0, 200);
        return;
      }
      event.rsvps[member.id] = status;
      outcome.value = "saved";
      state.ivrLog.unshift({
        id: crypto.randomUUID(),
        at: new Date().toISOString(),
        phone,
        action: "meeting-response",
        memberId: member.id,
        eventId: event.id,
        result: RESULT[status],
      });
      state.ivrLog = state.ivrLog.slice(0, 200);
    });
  } catch {
    return plain(MISSED);
  }

  if (outcome.value === "none") return plain(NONE);
  return plain(outcome.value === "saved" ? THANKS : MISSED);
}

export async function GET(request: Request) {
  return handle(request);
}

export async function POST(request: Request) {
  return handle(request);
}
