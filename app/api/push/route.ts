import { NextResponse } from "next/server";
import { getSessionUser } from "@/lib/auth";
import { loadVapidKeys, removePushSubscription, savePushSubscription } from "@/lib/web-push";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  const me = await getSessionUser();
  if (!me) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  return NextResponse.json({ publicKey: loadVapidKeys().publicKey });
}

export async function POST(request: Request) {
  const me = await getSessionUser();
  if (!me) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const body = (await request.json()) as {
    endpoint?: string;
    keys?: { p256dh?: string; auth?: string };
  };
  if (!body.endpoint?.startsWith("https://") || !body.keys?.p256dh || !body.keys.auth) {
    return NextResponse.json({ error: "invalid" }, { status: 400 });
  }
  await savePushSubscription({
    memberId: me.id,
    endpoint: body.endpoint,
    keys: { p256dh: body.keys.p256dh, auth: body.keys.auth },
  });
  return NextResponse.json({ ok: true });
}

export async function DELETE(request: Request) {
  const me = await getSessionUser();
  if (!me) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const body = (await request.json().catch(() => null)) as { endpoint?: string } | null;
  if (!body?.endpoint) return NextResponse.json({ error: "invalid" }, { status: 400 });
  await removePushSubscription(me.id, body.endpoint);
  return NextResponse.json({ ok: true });
}
