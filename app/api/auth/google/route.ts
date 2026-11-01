import { randomBytes } from "crypto";
import { NextResponse, type NextRequest } from "next/server";
import { oauthOrigin, safeNextPath } from "@/lib/google-auth";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const STATE_COOKIE = "chevra_google";
const NEXT_COOKIE = "chevra_google_next";

function cookieBase(request: NextRequest) {
  const proto = request.headers.get("x-forwarded-proto")?.split(",")[0]?.trim();
  const secure = proto ? proto === "https" : request.nextUrl.protocol === "https:";
  return { httpOnly: true, sameSite: "lax" as const, path: "/", secure };
}

export async function GET(request: NextRequest) {
  const origin = oauthOrigin(request);
  const next = safeNextPath(request.nextUrl.searchParams.get("next"));
  const clientId = process.env.GOOGLE_CLIENT_ID;
  const clientSecret = process.env.GOOGLE_CLIENT_SECRET;
  if (!clientId || !clientSecret) {
    const url = new URL("/login", origin);
    url.searchParams.set("google", "config");
    if (next) url.searchParams.set("next", next);
    return NextResponse.redirect(url);
  }

  const state = randomBytes(24).toString("hex");
  const redirectUri = `${origin}/api/auth/google/callback`;
  const url = new URL("https://accounts.google.com/o/oauth2/v2/auth");
  url.searchParams.set("client_id", clientId);
  url.searchParams.set("redirect_uri", redirectUri);
  url.searchParams.set("response_type", "code");
  url.searchParams.set("scope", "openid email profile");
  url.searchParams.set("state", state);
  url.searchParams.set("prompt", "select_account");

  const response = NextResponse.redirect(url);
  const base = cookieBase(request);
  response.cookies.set(STATE_COOKIE, state, { ...base, maxAge: 600 });
  if (next) response.cookies.set(NEXT_COOKIE, next, { ...base, maxAge: 600 });
  else response.cookies.set(NEXT_COOKIE, "", { ...base, maxAge: 0 });
  return response;
}
