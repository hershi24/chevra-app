import { NextResponse } from "next/server";
import { getSessionUser } from "@/lib/auth";
import { cancelSubject } from "@/lib/email";
import { gatheringLabel } from "@/lib/format";
import { recordDeliveries, rememberOrigin, sendGatheringEmail } from "@/lib/nudge";
import { can } from "@/lib/permissions";
import { inviteOrigin } from "@/lib/request-origin";
import { readState, updateState } from "@/lib/store";
import type { EmailDelivery, IvrLog } from "@/lib/types";
import { sendTzintuk, yemotConfigured } from "@/lib/yemot";

export const runtime = "nodejs";

export async function POST(request: Request) {
  const me = await getSessionUser();
  if (!me || !can(me, "sendInvites")) {
    return NextResponse.json({ error: "רק מנהל מערכת יכול לשלוח הזמנות" }, { status: 403 });
  }

  const body = (await request.json()) as {
    eventId?: string;
    note?: string;
    memberId?: string;
    memberIds?: string[];
    variant?: "invite" | "nudge" | "cancel";
  };
  const variant = body.variant === "nudge" || body.variant === "cancel" ? body.variant : "invite";
  const note = body.note?.trim().slice(0, 1000) ?? "";
  const state = await readState();
  const event = state.gatherings.find((g) => g.id === body.eventId);
  if (!event) {
    return NextResponse.json({ error: "החברה לא נמצאה" }, { status: 404 });
  }
  const picked = body.memberId ? [body.memberId] : Array.isArray(body.memberIds) ? body.memberIds : null;
  const members = picked ? state.members.filter((member) => picked.includes(member.id)) : state.members;
  if (picked && !members.length) {
    return NextResponse.json({ error: "החבר לא נמצא" }, { status: 404 });
  }

  const origin = inviteOrigin(request);
  rememberOrigin(origin);
  const rows: { memberId: string; delivery: EmailDelivery }[] = [];
  const calls: { memberId: string; phone: string; ok: boolean; skipped?: boolean; error?: string }[] = [];
  const shouldCall = variant === "invite" && yemotConfigured();
  for (const member of members) {
    const delivery = await sendGatheringEmail(state, event, member, {
      origin,
      note,
      senderName: me.displayName,
      variant,
    });
    rows.push({ memberId: member.id, delivery });
    if (shouldCall) calls.push({ memberId: member.id, ...(await sendTzintuk(member.phone)) });
  }
  const deliveries = rows.map((row) => row.delivery);

  const sentCount = deliveries.filter((row) => row.status === "sent").length;
  const failedCount = deliveries.filter((row) => row.status === "failed").length;
  const callCount = calls.filter((row) => row.ok).length;
  const callFailedCount = calls.filter((row) => !row.ok && !row.skipped).length;
  try {
    await updateState((s) => {
      recordDeliveries(s, event.id, rows, variant);
      s.emailLog.unshift({
        id: crypto.randomUUID(),
        eventId: event.id,
        sentAt: new Date().toISOString(),
        recipients: deliveries.filter((row) => row.status === "sent").map((row) => row.to),
        subject:
          variant === "cancel"
            ? cancelSubject(event)
            : variant === "nudge"
              ? "מחכים רק להחלטה שלך"
              : `הזמנה: ${gatheringLabel(event)}`,
        deliveries,
      });
      for (const call of calls) {
        if (call.skipped) continue;
        const entry: IvrLog = {
          id: crypto.randomUUID(),
          at: new Date().toISOString(),
          phone: call.phone,
          action: "tzintuk",
          memberId: call.memberId,
          eventId: event.id,
          result: call.ok ? "tzintuk_sent" : "tzintuk_failed",
        };
        s.ivrLog.unshift(entry);
      }
    });
  } catch {
    // The send report still goes back even if the log could not be stored.
  }

  return NextResponse.json({ deliveries, sentCount, failedCount, callCount, callFailedCount });
}
