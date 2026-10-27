import { NextResponse } from "next/server";
import { gatheringLabel } from "@/lib/format";
import { readState, upcomingGathering, updateState } from "@/lib/store";
import type { AppState, Gathering, RsvpStatus } from "@/lib/types";
import { samePhone, yemotPhone } from "@/lib/yemot";

export const runtime = "nodejs";

const TZ = "Asia/Jerusalem";
const DIGITS = "=digits,1,1,1,SelectedResponse,no,no,1,7";
const THANKS = "read=t-תודה רבה, בחירתכם נרשמה בהצלחה. להתראות.=no&hangup=yes";
const MISSED = "read=t-לא הצלחנו לזהות את המספר. להתראות.=no&hangup=yes";
const NONE = "read=t-שלום לכם. אין כרגע חברה קרובה להצבעה. להתראות.=no&hangup=yes";

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

function speakable(value: string) {
  return value.replace(/[=&]/g, " ").replace(/\s*[·•]\s*/g, ", ").replace(/\s+/g, " ").trim();
}

function spokenWhen(iso: string) {
  const date = new Date(iso);
  const weekday = new Intl.DateTimeFormat("he-IL", { timeZone: TZ, weekday: "long" }).format(date);
  const clock = new Intl.DateTimeFormat("en-GB", {
    timeZone: TZ,
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
  }).format(date);
  const dayKey = (value: Date) => new Intl.DateTimeFormat("en-CA", { timeZone: TZ }).format(value);
  const days = Math.round((Date.parse(dayKey(date)) - Date.parse(dayKey(new Date()))) / 86_400_000);
  const when = days === 0 ? `היום, ${weekday}` : days === 1 ? `מחר, ${weekday}` : weekday;
  return `${when}, בשעה ${clock}`;
}

function gatheringPrompt(event: Gathering) {
  const title = speakable(gatheringLabel(event));
  const topic = speakable(event.topic ?? "");
  const topicLine = topic && topic !== title && !title.includes(topic) && !topic.includes(title) ? ` הנושא: ${topic}.` : "";
  const place = event.location?.trim() ? ` במקום ${speakable(event.location)}.` : "";
  const text = speakable(
    `שלום לכם. החברה הבאה: ${title}.${topicLine} ${spokenWhen(event.startsAt)}.${place} הקישו 1 לאישור והגעה, 2 לאולי, או 3 לביטול.`
  );
  return `read=t-${text}${DIGITS}`;
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
  const selected = pick(params, ["SelectedResponse"]);
  if (!selected) {
    const state = await readState();
    const event = upcomingGathering(state);
    return plain(event ? gatheringPrompt(event) : NONE);
  }

  const status = STATUS[selected];
  const phone = yemotPhone(pick(params, ["ApiPhone", "phone", "Phone"]));
  if (!status || !phone) return plain(MISSED);

  let updated = false;
  try {
    await updateState((state) => {
      const member = state.members.find((item) => samePhone(item.phone, phone));
      const event = gatheringFor(state, phone);
      if (!member || !event || event.status !== "upcoming") {
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
      updated = true;
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

  return plain(updated ? THANKS : MISSED);
}

export async function GET(request: Request) {
  return handle(request);
}

export async function POST(request: Request) {
  return handle(request);
}
