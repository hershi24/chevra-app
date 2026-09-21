import { NextResponse } from "next/server";
import { getSessionUser } from "@/lib/auth";
import { can } from "@/lib/permissions";
import { updateState, upcomingGathering } from "@/lib/store";
import type { RsvpStatus } from "@/lib/types";

export const runtime = "nodejs";

/**
 * IVR / Tzintuk webhook.
 * Compatible with Twilio-style callbacks and generic providers.
 *
 * POST JSON:
 * { phone, digits, eventId?, action? }
 *
 * digits: "1" = מאשר הגעה, "2" = לא אוכל להגיע
 * action: "tzintuk" | "ivr_update"
 */
export async function POST(request: Request) {
  const secret = process.env.IVR_WEBHOOK_SECRET;
  if (secret) {
    const header = request.headers.get("authorization") ?? "";
    if (header !== `Bearer ${secret}`) {
      return NextResponse.json({ error: "unauthorized" }, { status: 401 });
    }
  } else {
    const me = await getSessionUser();
    if (me && !can(me, "triggerIvr")) {
      return NextResponse.json({ error: "אין הרשאה" }, { status: 403 });
    }
  }

  const body = (await request.json()) as {
    phone?: string;
    digits?: string;
    eventId?: string;
    action?: string;
    From?: string;
    Digits?: string;
  };

  const phone = normalizePhone(body.phone || body.From || "");
  const digits = String(body.digits || body.Digits || "");
  const action = body.action || (digits ? "ivr_update" : "tzintuk");

  let result = "logged";
  let memberId: string | undefined;
  let eventId = body.eventId;

  const state = await updateState((s) => {
    const member = s.members.find((m) => normalizePhone(m.phone) === phone);
    memberId = member?.id;
    const event = eventId
      ? s.gatherings.find((g) => g.id === eventId)
      : upcomingGathering(s);
    eventId = event?.id;

    if (member && event && (digits === "1" || digits === "2")) {
      const status: RsvpStatus = digits === "1" ? "yes" : "no";
      event.rsvps[member.id] = status;
      result = status === "yes" ? "rsvp_yes" : "rsvp_no";
    } else if (action === "tzintuk") {
      result = member ? "tzintuk_queued" : "unknown_phone";
    } else if (!member) {
      result = "unknown_phone";
    }

    s.ivrLog.unshift({
      id: crypto.randomUUID(),
      at: new Date().toISOString(),
      phone: phone || "unknown",
      action,
      memberId,
      eventId,
      result,
    });
  });

  const say =
    result === "rsvp_yes"
      ? "תודה. ההגעה אושרה."
      : result === "rsvp_no"
        ? "תודה. עדכנו שלא תגיע."
        : result === "tzintuk_queued"
          ? "צלצול קצר נשלח."
          : "לא זיהינו את המספר.";

  return NextResponse.json({
    ok: true,
    result,
    memberId,
    eventId,
    twiml: `<?xml version="1.0" encoding="UTF-8"?><Response><Say language="he-IL">${say}</Say></Response>`,
    log: state.ivrLog[0],
  });
}

function normalizePhone(value: string) {
  return value.replace(/[^\d]/g, "").replace(/^972/, "0");
}
