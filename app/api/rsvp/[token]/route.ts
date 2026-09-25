import { NextResponse } from "next/server";
import { applyRsvp, readRsvp } from "@/lib/rsvp";

export const runtime = "nodejs";

export async function GET(
  request: Request,
  context: { params: Promise<{ token: string }> }
) {
  const { token } = await context.params;
  const choice = new URL(request.url).searchParams.get("c");
  if (choice === "yes" || choice === "no" || choice === "maybe") {
    return respond(await applyRsvp(token, choice));
  }
  return respond(await readRsvp(token));
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
  return respond(await applyRsvp(token, body.choice));
}

function respond(result: Awaited<ReturnType<typeof readRsvp>>) {
  if (!result) return NextResponse.json({ error: "קישור לא תקין" }, { status: 404 });
  return NextResponse.json(result);
}
