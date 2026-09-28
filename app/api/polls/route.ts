import { NextResponse } from "next/server";
import { getSessionUser } from "@/lib/auth";
import { deliverPollMail, pollInviteHtml, pollResultsHtml } from "@/lib/poll-email";
import { canAccessPoll, findPollMessage } from "@/lib/poll";
import { isLeader } from "@/lib/permissions";
import { inviteOrigin } from "@/lib/request-origin";
import { readState, updateState } from "@/lib/store";

export const runtime = "nodejs";

export async function POST(request: Request) {
  const me = await getSessionUser();
  if (!me || !isLeader(me)) {
    return NextResponse.json({ error: "רק מנהל או ראש החברה יכולים לנהל סקר" }, { status: 403 });
  }
  const body = (await request.json()) as { messageId?: string; action?: "notify" | "close" };
  if (!body.messageId || (body.action !== "notify" && body.action !== "close")) {
    return NextResponse.json({ error: "בקשה לא תקינה" }, { status: 400 });
  }

  const state = await readState();
  const message = findPollMessage(state, body.messageId);
  if (!message?.poll) return NextResponse.json({ error: "הסקר לא נמצא" }, { status: 404 });
  const channel = state.channels.find((item) => item.id === message.channelId);
  if (!channel || !canAccessPoll(me, channel)) {
    return NextResponse.json({ error: "הסקר לא נמצא" }, { status: 404 });
  }

  if (body.action === "close") {
    if (message.poll.closed) return NextResponse.json({ error: "הסקר כבר נסגר" }, { status: 400 });
    await updateState((current) => {
      const target = findPollMessage(current, message.id);
      if (!target?.poll) throw new Error("הסקר לא נמצא");
      target.poll.closed = true;
    });
    const fresh = await readState();
    const origin = inviteOrigin(request);
    const closed = findPollMessage(fresh, message.id)!;
    const report = await deliverPollMail({
      members: fresh.members,
      message: closed,
      subject: `תוצאות הסקר: ${closed.poll!.question}`,
      htmlFor: (member) => pollResultsHtml({ member, message: closed, members: fresh.members, origin }),
    });
    return NextResponse.json({ ok: true, ...report });
  }

  const origin = inviteOrigin(request);
  const authorName = state.members.find((item) => item.id === message.authorId)?.displayName;
  const report = await deliverPollMail({
    members: state.members,
    message,
    subject: `סקר: ${message.poll.question}`,
    htmlFor: (member) => pollInviteHtml({ member, message, origin, authorName }),
  });
  return NextResponse.json({ ok: true, ...report });
}
