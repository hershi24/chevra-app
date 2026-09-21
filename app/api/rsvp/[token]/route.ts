import { NextResponse } from "next/server";
import { readState, updateState, upcomingGathering } from "@/lib/store";
import type { RsvpStatus } from "@/lib/types";

export const runtime = "nodejs";

function applyChoice(status: RsvpStatus) {
  return status;
}

export async function GET(
  request: Request,
  context: { params: Promise<{ token: string }> }
) {
  const { token } = await context.params;
  const url = new URL(request.url);
  const choice = url.searchParams.get("c");
  if (choice === "yes" || choice === "no") {
    return applyToken(token, choice);
  }
  const state = await readState();
  const row = state.tokens.find((t) => t.token === token);
  if (!row) return NextResponse.json({ error: "קישור לא תקין" }, { status: 404 });
  const event = state.gatherings.find((g) => g.id === row.eventId);
  const member = state.members.find((m) => m.id === row.memberId);
  return NextResponse.json({ event, member, status: event?.rsvps[row.memberId] ?? "pending" });
}

export async function POST(
  request: Request,
  context: { params: Promise<{ token: string }> }
) {
  const { token } = await context.params;
  const body = (await request.json()) as { choice?: string };
  if (body.choice !== "yes" && body.choice !== "no" && body.choice !== "maybe") {
    return NextResponse.json({ error: "בחירה לא תקינה" }, { status: 400 });
  }
  return applyToken(token, body.choice);
}

async function applyToken(token: string, choice: RsvpStatus) {
  const updated = await updateState((s) => {
    const row = s.tokens.find((t) => t.token === token);
    if (!row) throw new Error("missing");
    const event = s.gatherings.find((g) => g.id === row.eventId);
    if (!event) throw new Error("missing-event");
    event.rsvps[row.memberId] = applyChoice(choice);
  }).catch(() => null);

  if (!updated) {
    return NextResponse.json({ error: "קישור לא תקין" }, { status: 404 });
  }
  const row = updated.tokens.find((t) => t.token === token)!;
  const event = updated.gatherings.find((g) => g.id === row.eventId);
  const member = updated.members.find((m) => m.id === row.memberId);
  return NextResponse.json({
    ok: true,
    status: choice,
    event,
    member,
    upcoming: upcomingGathering(updated),
  });
}
