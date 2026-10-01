import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { AppShell } from "@/components/app-shell";
import { SESSION_COOKIE } from "@/lib/auth";
import { readState, toPublicState } from "@/lib/store";

export default async function AppLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const jar = await cookies();
  const id = jar.get(SESSION_COOKIE)?.value;
  if (!id) redirect("/login");
  const state = await readState();
  const me = state.members.find((member) => member.id === id);
  if (!me) redirect("/login");
  return <AppShell initial={toPublicState(state, me)}>{children}</AppShell>;
}
