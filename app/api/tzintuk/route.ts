import { NextResponse } from "next/server";
import { getSessionUser } from "@/lib/auth";
import { mergeNudgeRows, recordDeliveries } from "@/lib/nudge";
import { can } from "@/lib/permissions";
import { memberHasPhone } from "@/lib/phone";
import { readState, updateState } from "@/lib/store";
import type { IvrLog } from "@/lib/types";
import { sendTzintuk, yemotConfigured, type TzintukResult } from "@/lib/yemot";

export const runtime = "nodejs";

export async function POST(request: Request) {
  const me = await getSessionUser();
  if (!me || (!can(me, "sendInvites") && !can(me, "triggerIvr"))) {
    return NextResponse.json({ error: "רק מנהל מערכת יכול לשלוח צינתוק" }, { status: 403 });
  }
  if (!yemotConfigured()) {
    return NextResponse.json({ error: "אין אסימון ימות בשרת, הצינתוק לא יצא" }, { status: 400 });
  }

  const body = (await request.json()) as {
    eventId?: string;
    memberId?: string;
    memberIds?: string[];
    variant?: "invite" | "nudge";
  };
  const state = await readState();
  const event = state.gatherings.find((item) => item.id === body.eventId) ?? state.gatherings.find((item) => item.status === "upcoming");
  if (!event) {
    return NextResponse.json({ error: "אין חברה קרובה לשלוח אליה צינתוק" }, { status: 404 });
  }
  const picked = body.memberId ? [body.memberId] : Array.isArray(body.memberIds) ? body.memberIds : null;
  const members = (picked ? state.members.filter((member) => picked.includes(member.id)) : state.members).filter(memberHasPhone);
  if (!members.length) {
    return NextResponse.json({ error: picked ? "לחבר הזה אין מספר טלפון" : "אין לחברים מספר טלפון" }, { status: 404 });
  }

  const calls: Array<TzintukResult & { memberId: string; name: string }> = [];
  for (const member of members) {
    calls.push({ memberId: member.id, name: member.displayName, ...(await sendTzintuk(member.phone)) });
  }
  const callCount = calls.filter((row) => row.ok).length;
  const callFailedCount = calls.filter((row) => !row.ok && !row.skipped).length;
  const variant = body.variant === "nudge" ? "nudge" : "invite";
  try {
    await updateState((s) => {
      if (variant === "nudge") {
        recordDeliveries(
          s,
          event.id,
          mergeNudgeRows(
            [],
            calls,
            (id) => calls.find((row) => row.memberId === id)?.name ?? id
          ),
          "nudge"
        );
      }
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

  return NextResponse.json({ calls, callCount, callFailedCount });
}
