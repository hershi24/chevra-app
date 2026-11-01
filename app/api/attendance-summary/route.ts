import { NextResponse } from "next/server";
import { getSessionUser } from "@/lib/auth";
import { attendanceSummaryHtml, attendanceSummarySubject, sendEmail } from "@/lib/email";
import { memberById } from "@/lib/format";
import { memberAddress } from "@/lib/nudge-rules";
import { isLeader } from "@/lib/permissions";
import { inviteOrigin } from "@/lib/request-origin";
import { readState, updateState } from "@/lib/store";
import type { EmailDelivery } from "@/lib/types";

export const runtime = "nodejs";

export async function POST(request: Request) {
  const me = await getSessionUser();
  if (!me || !isLeader(me)) {
    return NextResponse.json({ error: "רק מנהל או ראש החברה יכולים לשלוח סיכום" }, { status: 403 });
  }

  const body = (await request.json()) as { eventId?: string };
  const state = await readState();
  const event = state.gatherings.find((item) => item.id === body.eventId);
  if (!event) return NextResponse.json({ error: "החברה לא נמצאה" }, { status: 404 });

  const leaders = state.members.filter((member) => member.role === "leader");
  if (!leaders.length) {
    return NextResponse.json({ error: "אין ראש חברה לשלוח אליו" }, { status: 400 });
  }

  const origin = inviteOrigin(request);
  const hostName = memberById(state.members, event.hostId)?.displayName;
  const subject = attendanceSummarySubject(event);
  const deliveries: EmailDelivery[] = [];
  for (const leader of leaders) {
    const address = memberAddress(leader);
    if (!address) {
      deliveries.push({
        to: leader.email?.trim() || "—",
        name: leader.displayName,
        status: "skipped",
        error: leader.email?.trim() ? "כתובת הדגמה לא נשלחת" : "אין כתובת מייל",
      });
      continue;
    }
    const html = attendanceSummaryHtml({
      leader,
      event,
      members: state.members,
      origin,
      hostName,
    });
    const result = await sendEmail({ to: address, subject, html });
    if ("mock" in result) {
      deliveries.push({
        to: address,
        name: leader.displayName,
        status: "failed",
        error: "אין מפתח Resend בשרת, המייל לא יצא",
      });
      continue;
    }
    deliveries.push({
      to: address,
      name: leader.displayName,
      status: result.ok ? "sent" : "failed",
      error: result.ok ? undefined : result.error || "השליחה נכשלה",
    });
  }

  const sentCount = deliveries.filter((row) => row.status === "sent").length;
  const failedCount = deliveries.filter((row) => row.status === "failed").length;
  try {
    await updateState((s) => {
      s.emailLog.unshift({
        id: crypto.randomUUID(),
        eventId: event.id,
        sentAt: new Date().toISOString(),
        recipients: deliveries.filter((row) => row.status === "sent").map((row) => row.to),
        subject,
        deliveries,
      });
    });
  } catch {
    // The send report still goes back even if the log could not be stored.
  }

  return NextResponse.json({
    deliveries,
    sentCount,
    failedCount,
    leaders: leaders.map((leader) => leader.displayName),
  });
}
