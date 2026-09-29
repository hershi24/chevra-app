import { redirect } from "next/navigation";
import { LoginView } from "@/components/login-view";
import { getSessionUser } from "@/lib/auth";

function safeNext(value: string | string[] | undefined) {
  const next = Array.isArray(value) ? value[0] : value;
  if (!next || !next.startsWith("/") || next.startsWith("//") || next.startsWith("/\\")) return undefined;
  if (next.startsWith("/login")) return undefined;
  return next;
}

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const next = safeNext((await searchParams).next);
  const user = await getSessionUser();
  if (user) redirect(next ?? "/");
  return <LoginView next={next} />;
}
