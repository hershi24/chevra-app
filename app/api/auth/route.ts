import { NextResponse } from "next/server";
import { clearSession, setSession } from "@/lib/auth";
import { publicMember, verifyPassword } from "@/lib/password";
import { readState } from "@/lib/store";

export const runtime = "nodejs";

export async function POST(request: Request) {
  const body = (await request.json()) as { password?: string; memberId?: string };
  const password = body.password ?? "";
  if (!password.trim()) {
    return NextResponse.json({ error: "נא להזין סיסמה" }, { status: 400 });
  }
  const state = await readState();
  const matches = state.members.filter((member) => verifyPassword(password, member.passwordHash));
  if (!matches.length) {
    return NextResponse.json({ error: "הסיסמה לא נכונה" }, { status: 401 });
  }

  const member = body.memberId ? matches.find((item) => item.id === body.memberId) : matches.length === 1 ? matches[0] : null;
  if (!member) {
    return NextResponse.json({
      choices: matches.map((item) => ({
        id: item.id,
        displayName: item.displayName,
        initials: item.initials,
        avatarColor: item.avatarColor,
      })),
    });
  }

  await setSession(member.id);
  return NextResponse.json({
    member: publicMember(member),
    mustChangePassword: Boolean(member.mustChangePassword),
  });
}

export async function DELETE() {
  await clearSession();
  return NextResponse.json({ ok: true });
}
