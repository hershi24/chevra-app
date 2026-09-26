import { createHmac, timingSafeEqual } from "crypto";

function secret() {
  return (
    process.env.SUPABASE_SERVICE_ROLE_KEY ||
    process.env.RESEND_API_KEY2 ||
    process.env.RESEND_API_KEY ||
    "chevra-local-rsvp"
  );
}

export function signPollVote(memberId: string, messageId: string, optionId: string) {
  const payload = Buffer.from(JSON.stringify({ m: memberId, p: messageId, o: optionId })).toString(
    "base64url"
  );
  const sig = createHmac("sha256", secret()).update(`poll.${payload}`).digest("base64url").slice(0, 32);
  return `pollv1.${payload}.${sig}`;
}

export function readPollVote(token: string): { memberId: string; messageId: string; optionId: string } | null {
  const [prefix, payload, sig] = token.split(".");
  if (prefix !== "pollv1" || !payload || !sig) return null;
  const expected = createHmac("sha256", secret()).update(`poll.${payload}`).digest("base64url").slice(0, 32);
  const left = Buffer.from(sig);
  const right = Buffer.from(expected);
  if (left.length !== right.length || !timingSafeEqual(left, right)) return null;
  try {
    const data = JSON.parse(Buffer.from(payload, "base64url").toString()) as {
      m?: string;
      p?: string;
      o?: string;
    };
    if (!data.m || !data.p || !data.o) return null;
    return { memberId: data.m, messageId: data.p, optionId: data.o };
  } catch {
    return null;
  }
}
