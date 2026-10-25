import { NextResponse } from "next/server";
import { getSessionUser } from "@/lib/auth";
import { runNudges } from "@/lib/nudge";
import { can } from "@/lib/permissions";
import { inviteOrigin } from "@/lib/request-origin";

export const runtime = "nodejs";

async function allowed(request: Request) {
  const secret = process.env.CRON_SECRET;
  if (secret) {
    const header = request.headers.get("authorization");
    const key = new URL(request.url).searchParams.get("key");
    if (header === `Bearer ${secret}` || key === secret) return true;
  }
  const me = await getSessionUser();
  return Boolean(me && can(me, "sendInvites"));
}

async function handle(request: Request) {
  if (!(await allowed(request))) {
    return NextResponse.json({ error: "אין הרשאה" }, { status: 403 });
  }
  const result = await runNudges(inviteOrigin(request));
  return NextResponse.json(result);
}

export const GET = handle;
export const POST = handle;
