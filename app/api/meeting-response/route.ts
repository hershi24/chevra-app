import { NextResponse } from "next/server";
import { upcomingGathering, updateState } from "@/lib/store";
import type { AppState, RsvpStatus } from "@/lib/types";
import { samePhone, yemotPhone } from "@/lib/yemot";

export const runtime = "nodejs";

const PROMPT =
  "read=t-שלום לכם. להזמנה למפגש הבא: הקישו 1 לאישור והגעה, 2 לאולי, או 3 לביטול.=digits,1,1,1,SelectedResponse,no,no,1,7";
const THANKS = "read=t-תודה רבה, בחירתכם נרשמה בהצלחה. להתראות.=no&hangup=yes";
const MISSED = "read=t-לא הצלחנו לזהות את המספר. להתראות.=no&hangup=yes";

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

async function readParams(request: Request) {
  const params: Record<string, string> = {};
  new URL(request.url).searchParams.forEach((value, key) => {
    params[key] = value;
  });
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

export async function POST(request: Request) {
  const params = await readParams(request);
  const selected = pick(params, ["SelectedResponse"]);
  if (!selected) return plain(PROMPT);

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
