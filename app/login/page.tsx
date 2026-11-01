import { redirect } from "next/navigation";
import { LoginView } from "@/components/login-view";
import { getSessionUser } from "@/lib/auth";
import { googleLoginMessage, safeNextPath } from "@/lib/google-auth";

function one(value: string | string[] | undefined) {
  return Array.isArray(value) ? value[0] : value;
}

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const params = await searchParams;
  const next = safeNextPath(one(params.next));
  const user = await getSessionUser();
  if (user) redirect(next ?? "/");
  return <LoginView next={next} googleError={googleLoginMessage(one(params.google))} />;
}
