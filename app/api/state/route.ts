import { NextResponse } from "next/server";
import { getSessionUser } from "@/lib/auth";
import { ensureGuideChannels } from "@/lib/channels";
import { persistQuietly, readState, toPublicState } from "@/lib/store";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  const me = await getSessionUser();
  if (!me) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }
  const state = structuredClone(await readState());
  if (ensureGuideChannels(state)) {
    void persistQuietly((current) => ensureGuideChannels(current));
  }
  const fresh = state.members.find((member) => member.id === me.id) ?? me;
  return NextResponse.json(toPublicState(state, fresh));
}
