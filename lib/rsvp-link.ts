import { createHmac, timingSafeEqual } from "crypto";

function secret() {
  return (
    process.env.SUPABASE_SERVICE_ROLE_KEY ||
    process.env.RESEND_API_KEY2 ||
    process.env.RESEND_API_KEY ||
    "chevra-local-rsvp"
  );
}

export function signRsvpToken(memberId: string, eventId: string) {
  const payload = Buffer.from(JSON.stringify({ m: memberId, e: eventId })).toString("base64url");
  const sig = createHmac("sha256", secret()).update(payload).digest("base64url").slice(0, 32);
  return `tokv1.${payload}.${sig}`;
}

export function readSignedToken(token: string): { memberId: string; eventId: string } | null {
  const [prefix, payload, sig] = token.split(".");
  if (prefix !== "tokv1" || !payload || !sig) return null;
  const expected = createHmac("sha256", secret()).update(payload).digest("base64url").slice(0, 32);
  const left = Buffer.from(sig);
  const right = Buffer.from(expected);
  if (left.length !== right.length || !timingSafeEqual(left, right)) return null;
  try {
    const data = JSON.parse(Buffer.from(payload, "base64url").toString()) as { m?: string; e?: string };
    if (!data.m || !data.e) return null;
    return { memberId: data.m, eventId: data.e };
  } catch {
    return null;
  }
}
