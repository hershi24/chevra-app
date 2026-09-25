import { NextResponse } from "next/server";
import { getSessionUser } from "@/lib/auth";
import { invitationHtml, sendEmail } from "@/lib/email";
import { gatheringLabel, memberById } from "@/lib/format";
import { can } from "@/lib/permissions";
import { signRsvpToken } from "@/lib/rsvp-link";
import { readState, updateState } from "@/lib/store";
import type { EmailDelivery } from "@/lib/types";

export const runtime = "nodejs";

export async function POST(request: Request) {
  const me = await getSessionUser();
  if (!me || !can(me, "sendInvites")) {
    return NextResponse.json({ error: "רק מנהל מערכת יכול לשלוח הזמנות" }, { status: 403 });
  }

  const body = (await request.json()) as { eventId?: string; note?: string };
  const note = body.note?.trim().slice(0, 1000) ?? "";
  const state = await readState();
  const event = state.gatherings.find((g) => g.id === body.eventId);
  if (!event) {
    return NextResponse.json({ error: "החברה לא נמצאה" }, { status: 404 });
  }

  const origin = inviteOrigin(request);
  const deliveries: EmailDelivery[] = [];

  for (const member of state.members) {
    const address = member.email?.trim() ?? "";
    if (!address || address.endsWith("@chevra.local")) {
      deliveries.push({
        to: address || "—",
        name: member.displayName,
        status: "skipped",
        error: address ? "כתובת הדגמה לא נשלחת" : "אין כתובת מייל",
      });
      continue;
    }
    const token = signRsvpToken(member.id, event.id);
    const yesUrl = `${origin}/rsvp/${token}?c=yes`;
    const maybeUrl = `${origin}/rsvp/${token}?c=maybe`;
    const noUrl = `${origin}/rsvp/${token}?c=no`;
    const html = invitationHtml({
      member,
      event,
      hostName: memberById(state.members, event.hostId)?.displayName ?? "",
      kibudName: memberById(state.members, event.kibudId)?.displayName,
      lecturerName: memberById(state.members, event.lecturerId)?.displayName,
      yesUrl,
      maybeUrl,
      noUrl,
      note,
    });
    const result = await sendEmail({
      to: address,
      subject: `הזמנה: ${gatheringLabel(event)}`,
      html,
    });
    if ("mock" in result) {
      deliveries.push({
        to: address,
        name: member.displayName,
        status: "failed",
        error: "אין מפתח Resend בשרת, המייל לא יצא",
      });
      continue;
    }
    deliveries.push({
      to: address,
      name: member.displayName,
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
        subject: `הזמנה: ${gatheringLabel(event)}`,
        deliveries,
      });
    });
  } catch {
    // The send report still goes back even if the log could not be stored.
  }

  return NextResponse.json({ deliveries, sentCount, failedCount });
}

function inviteOrigin(request: Request) {
  const forwardedProto = request.headers.get("x-forwarded-proto")?.split(",")[0]?.trim() || "https";
  const hosts = [
    request.headers.get("x-forwarded-host"),
    request.headers.get("host"),
  ];
  for (const raw of hosts) {
    const host = raw?.split(",")[0]?.trim();
    if (host && isPublicHost(host)) return `${forwardedProto}://${host}`;
  }
  const external = process.env.RENDER_EXTERNAL_URL?.replace(/\/$/, "");
  if (external) return external;
  return new URL(request.url).origin;
}

function isPublicHost(host: string) {
  const name = host.replace(/:\d+$/, "").replace(/^\[|\]$/g, "").toLowerCase();
  return name !== "0.0.0.0" && name !== "127.0.0.1" && name !== "localhost" && name !== "::1";
}
