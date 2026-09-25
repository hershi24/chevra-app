import { NextResponse } from "next/server";
import { getSessionUser } from "@/lib/auth";
import { invitationHtml, sendEmail } from "@/lib/email";
import { gatheringLabel, memberById } from "@/lib/format";
import { can } from "@/lib/permissions";
import { readState, updateState } from "@/lib/store";

export const runtime = "nodejs";

export async function POST(request: Request) {
  const me = await getSessionUser();
  if (!me || !can(me, "sendInvites")) {
    return NextResponse.json({ error: "רק מנהל מערכת יכול לשלוח הזמנות" }, { status: 403 });
  }

  const body = (await request.json()) as { eventId?: string };
  const state = await readState();
  const event = state.gatherings.find((g) => g.id === body.eventId);
  if (!event) {
    return NextResponse.json({ error: "החברה לא נמצאה" }, { status: 404 });
  }

  const origin = inviteOrigin(request);
  const sent: { memberId: string; to: string; yesUrl: string; noUrl: string; mock: boolean }[] = [];

  for (const member of state.members) {
    let token = state.tokens.find((t) => t.eventId === event.id && t.memberId === member.id)?.token;
    if (!token) {
      token = `tok-${member.id}-${event.id}-${Math.random().toString(36).slice(2, 10)}`;
      await updateState((s) => {
        s.tokens.push({ token: token!, eventId: event.id, memberId: member.id });
      });
    }
    const yesUrl = `${origin}/rsvp/${token}?c=yes`;
    const noUrl = `${origin}/rsvp/${token}?c=no`;
    const html = invitationHtml({
      member,
      event,
      hostName: memberById(state.members, event.hostId)?.displayName ?? "",
      kibudName: memberById(state.members, event.kibudId)?.displayName,
      lecturerName: memberById(state.members, event.lecturerId)?.displayName,
      yesUrl,
      noUrl,
    });
    const result = await sendEmail({
      to: member.email,
      subject: `הזמנה: ${gatheringLabel(event)}`,
      html,
    });
    sent.push({
      memberId: member.id,
      to: member.email,
      yesUrl,
      noUrl,
      mock: Boolean((result as { mock?: boolean }).mock),
    });
  }

  await updateState((s) => {
    s.emailLog.unshift({
      id: crypto.randomUUID(),
      eventId: event.id,
      sentAt: new Date().toISOString(),
      recipients: sent.map((row) => row.to),
      subject: `הזמנה: ${gatheringLabel(event)}`,
    });
  });

  return NextResponse.json({ sent, mock: sent.every((row) => row.mock) });
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
