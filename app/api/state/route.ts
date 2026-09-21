import { NextResponse } from "next/server";
import { getSessionUser } from "@/lib/auth";
import { readState, toPublicState } from "@/lib/store";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  const me = await getSessionUser();
  if (!me) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }
  const state = await readState();
  return NextResponse.json(toPublicState(state, me));
}
