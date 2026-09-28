import { NextResponse } from "next/server";
import { getSessionUser } from "@/lib/auth";
import { invitationHtml } from "@/lib/email";
import { memberById } from "@/lib/format";
import { can } from "@/lib/permissions";
import { inviteOrigin } from "@/lib/request-origin";
import { readState } from "@/lib/store";

export const runtime = "nodejs";

export async function GET(request: Request) {
  const me = await getSessionUser();
  if (!me || !can(me, "sendInvites")) {
    return NextResponse.json({ error: "רק מנהל מערכת יכול לראות את ההזמנה" }, { status: 403 });
  }
  const url = new URL(request.url);
  const state = await readState();
  const event = state.gatherings.find((g) => g.id === url.searchParams.get("eventId"));
  if (!event) {
    return NextResponse.json({ error: "החברה לא נמצאה" }, { status: 404 });
  }
  const html = invitationHtml({
    member: me,
    event,
    hostName: memberById(state.members, event.hostId)?.displayName ?? "",
    kibudName: memberById(state.members, event.kibudId)?.displayName,
    lecturerName: memberById(state.members, event.lecturerId)?.displayName,
    senderName: me.displayName,
    yesUrl: "#",
    maybeUrl: "#",
    noUrl: "#",
    note: url.searchParams.get("note")?.slice(0, 1000) ?? "",
    origin: inviteOrigin(request),
  });
  return new NextResponse(html, {
    headers: { "Content-Type": "text/html; charset=utf-8", "Cache-Control": "no-store" },
  });
}
