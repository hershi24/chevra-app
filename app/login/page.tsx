import { redirect } from "next/navigation";
import { LoginView } from "@/components/login-view";
import { getSessionUser } from "@/lib/auth";

export default async function LoginPage() {
  const user = await getSessionUser();
  if (user) redirect("/");
  return <LoginView />;
}
