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
    return answer(applyRsvp(token, choice));
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
  return answer(applyRsvp(token, body.choice));
}

async function answer(pending: ReturnType<typeof applyRsvp>) {
  try {
    return respond(await pending);
  } catch (error) {
    const message = error instanceof Error ? error.message : "שגיאה";
    if (message === "החברה כבר התקיימה") {
      return NextResponse.json({ error: message }, { status: 400 });
    }
    throw error;
  }
}

function respond(result: Awaited<ReturnType<typeof readRsvp>>) {
  if (!result) return NextResponse.json({ error: "קישור לא תקין" }, { status: 404 });
  return NextResponse.json(result);
}
