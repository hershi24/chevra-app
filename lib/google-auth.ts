import { timingSafeEqual } from "crypto";
import { inviteOrigin } from "./request-origin";
import type { Member } from "./types";

/** Origin the browser actually used, so the Google redirect matches the open tab. */
export function oauthOrigin(request: Request) {
  const forwardedHost = request.headers.get("x-forwarded-host")?.split(",")[0]?.trim();
  const hostHeader = request.headers.get("host")?.split(",")[0]?.trim();
  const host = [forwardedHost, hostHeader].find((value) => value && !value.startsWith("0.0.0.0"));
  if (!host) return inviteOrigin(request);
  const name = host.replace(/:\d+$/, "").replace(/^\[|\]$/g, "").toLowerCase();
  const local = name === "localhost" || name === "127.0.0.1" || name === "::1";
  const proto = request.headers.get("x-forwarded-proto")?.split(",")[0]?.trim() || (local ? "http" : "https");
  return `${proto}://${host}`;
}

const MESSAGES: Record<string, string> = {
  nomatch: "המייל בגוגל לא תואם לאף חבר בחבורה. אפשר להיכנס עם הסיסמה.",
  shared: "המייל הזה רשום ליותר מחבר אחד. פנו למנהל החבורה.",
  unverified: "גוגל לא אימתה את המייל הזה.",
  denied: "ההתחברות עם גוגל בוטלה.",
  config: "ההתחברות עם גוגל עדיין לא הוגדרה בשרת.",
  failed: "ההתחברות עם גוגל נכשלה. נסו שוב.",
};

export function googleLoginMessage(code: string | undefined) {
  if (!code) return undefined;
  return MESSAGES[code];
}

export function safeNextPath(value: string | null | undefined) {
  if (!value || !value.startsWith("/") || value.startsWith("//") || value.startsWith("/\\")) return undefined;
  if (value.startsWith("/login")) return undefined;
  return value;
}

export function sameToken(left: string, right: string) {
  const a = Buffer.from(left);
  const b = Buffer.from(right);
  if (a.length !== b.length || a.length === 0) return false;
  return timingSafeEqual(a, b);
}

export type GoogleMatch =
  | { status: "ok"; member: Member }
  | { status: "none" }
  | { status: "shared" };

function emailKey(email: string) {
  return email.trim().toLowerCase();
}

function isMemberEmail(email: string) {
  const key = emailKey(email);
  return key.includes("@") && !key.endsWith("@chevra.local");
}

/** A Google account can sign in only when its verified email belongs to exactly one member. */
export function matchGoogleMember(members: Member[], email: string): GoogleMatch {
  if (!isMemberEmail(email)) return { status: "none" };
  const key = emailKey(email);
  const matches = members.filter((member) => isMemberEmail(member.email) && emailKey(member.email) === key);
  if (matches.length === 1) return { status: "ok", member: matches[0] };
  if (matches.length > 1) return { status: "shared" };
  return { status: "none" };
}

/** Keep only a Google-hosted portrait, and ask for a size that stays sharp in the avatar. */
export function googlePictureUrl(raw: string | undefined) {
  if (!raw) return undefined;
  let url: URL;
  try {
    url = new URL(raw);
  } catch {
    return undefined;
  }
  if (url.protocol !== "https:") return undefined;
  const host = url.hostname.toLowerCase();
  if (host !== "lh3.googleusercontent.com" && !host.endsWith(".googleusercontent.com")) return undefined;
  url.pathname = url.pathname.replace(/=s\d+(-c)?$/, "=s256-c");
  return url.toString();
}

export async function fetchGoogleProfile(code: string, redirectUri: string) {
  const clientId = process.env.GOOGLE_CLIENT_ID;
  const clientSecret = process.env.GOOGLE_CLIENT_SECRET;
  if (!clientId || !clientSecret) throw new Error("config");
  const tokenRes = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      code,
      client_id: clientId,
      client_secret: clientSecret,
      redirect_uri: redirectUri,
      grant_type: "authorization_code",
    }),
    signal: AbortSignal.timeout(12_000),
  });
  const token = (await tokenRes.json()) as { access_token?: string };
  if (!tokenRes.ok || !token.access_token) throw new Error("token");
  const infoRes = await fetch("https://openidconnect.googleapis.com/v1/userinfo", {
    headers: { Authorization: `Bearer ${token.access_token}` },
    signal: AbortSignal.timeout(12_000),
  });
  const info = (await infoRes.json()) as {
    email?: string;
    email_verified?: boolean | string;
    picture?: string;
  };
  if (!infoRes.ok || !info.email) throw new Error("profile");
  return {
    email: info.email,
    emailVerified: info.email_verified === true || info.email_verified === "true",
    picture: info.picture,
  };
}
