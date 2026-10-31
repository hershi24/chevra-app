import { NextResponse, type NextRequest } from "next/server";
import { SESSION_COOKIE } from "@/lib/auth";
import { fetchGoogleProfile, googlePictureUrl, matchGoogleMember, oauthOrigin, safeNextPath, sameToken } from "@/lib/google-auth";
import { readState, updateState } from "@/lib/store";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const STATE_COOKIE = "chevra_google";
const NEXT_COOKIE = "chevra_google_next";

function clearOauth(response: NextResponse) {
  response.cookies.set(STATE_COOKIE, "", { httpOnly: true, sameSite: "lax", path: "/", maxAge: 0 });
  response.cookies.set(NEXT_COOKIE, "", { httpOnly: true, sameSite: "lax", path: "/", maxAge: 0 });
}

function fail(request: NextRequest, origin: string, code: string) {
  const url = new URL("/login", origin);
  url.searchParams.set("google", code);
  const next = safeNextPath(request.cookies.get(NEXT_COOKIE)?.value);
  if (next) url.searchParams.set("next", next);
  const response = NextResponse.redirect(url);
  clearOauth(response);
  return response;
}

export async function GET(request: NextRequest) {
  const origin = oauthOrigin(request);
  const googleError = request.nextUrl.searchParams.get("error");
  if (googleError === "access_denied") return fail(request, origin, "denied");
  if (googleError) return fail(request, origin, "failed");
  if (!process.env.GOOGLE_CLIENT_ID || !process.env.GOOGLE_CLIENT_SECRET) return fail(request, origin, "config");

  const code = request.nextUrl.searchParams.get("code");
  const state = request.nextUrl.searchParams.get("state");
  const saved = request.cookies.get(STATE_COOKIE)?.value;
  if (!code || !state || !saved || !sameToken(state, saved)) return fail(request, origin, "failed");

  let profile: Awaited<ReturnType<typeof fetchGoogleProfile>>;
  try {
    profile = await fetchGoogleProfile(code, `${origin}/api/auth/google/callback`);
  } catch (error) {
    console.error("google login failed", error instanceof Error ? error.message : "error");
    return fail(request, origin, "failed");
  }
  if (!profile.emailVerified) return fail(request, origin, "unverified");

  const found = matchGoogleMember((await readState()).members, profile.email);
  if (found.status === "none") return fail(request, origin, "nomatch");
  if (found.status === "shared") return fail(request, origin, "shared");

  const picture = googlePictureUrl(profile.picture);
  if (picture && found.member.avatarUrl !== picture) {
    const memberId = found.member.id;
    await updateState((state) => {
      const member = state.members.find((item) => item.id === memberId);
      if (member) member.avatarUrl = picture;
    });
  }

  const next = safeNextPath(request.cookies.get(NEXT_COOKIE)?.value) ?? "/";
  const response = NextResponse.redirect(new URL(next, origin));
  response.cookies.set(SESSION_COOKIE, found.member.id, {
    httpOnly: true,
    sameSite: "lax",
    path: "/",
    maxAge: 60 * 60 * 24 * 180,
  });
  clearOauth(response);
  return response;
}
