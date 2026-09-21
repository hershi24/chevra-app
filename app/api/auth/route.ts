import { NextResponse } from "next/server";
import { clearSession, findMemberByUsername, setSession } from "@/lib/auth";
import { readState } from "@/lib/store";

export const runtime = "nodejs";

export async function POST(request: Request) {
  const body = (await request.json()) as { username?: string };
  const username = body.username?.trim() ?? "";
  if (!username) {
    return NextResponse.json({ error: "נא להזין שם משתמש" }, { status: 400 });
  }
  const state = await readState();
  const member = findMemberByUsername(state.members, username);
  if (!member) {
    return NextResponse.json(
      { error: "לא מצאנו את השם הזה בחבורה. נסו שם פרטי כמו דוד, משה או יוסף." },
      { status: 401 }
    );
  }
  await setSession(member.id);
  return NextResponse.json({ member });
}

export async function DELETE() {
  await clearSession();
  return NextResponse.json({ ok: true });
}
