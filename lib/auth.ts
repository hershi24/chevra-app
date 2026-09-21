import { cookies } from "next/headers";
import { readState } from "./store";
import type { Member } from "./types";

export const SESSION_COOKIE = "chevra_user";

export async function getSessionUser(): Promise<Member | null> {
  const jar = await cookies();
  const id = jar.get(SESSION_COOKIE)?.value;
  if (!id) return null;
  const state = await readState();
  return state.members.find((m) => m.id === id) ?? null;
}

export async function setSession(memberId: string) {
  const jar = await cookies();
  jar.set(SESSION_COOKIE, memberId, {
    httpOnly: true,
    sameSite: "lax",
    path: "/",
    maxAge: 60 * 60 * 24 * 180,
  });
}

export async function clearSession() {
  const jar = await cookies();
  jar.delete(SESSION_COOKIE);
}

export function findMemberByUsername(members: Member[], username: string) {
  const q = username.trim();
  const aliases: Record<string, string> = {
    admin: "דוד",
    david: "דוד",
    moshe: "משה",
    yossi: "יוסף",
    avraham: "אברהם",
    yaakov: "יעקב",
    shlomo: "שלמה",
    natan: "נתן",
    chaim: "חיים",
  };
  const normalized = aliases[q.toLowerCase()] ?? q;
  return members.find(
    (m) =>
      m.username === normalized ||
      m.displayName === q ||
      m.username === q ||
      m.displayName.replaceAll(" ", "") === q.replaceAll(" ", "")
  );
}
