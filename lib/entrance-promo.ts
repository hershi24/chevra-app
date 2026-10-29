import type { EntrancePromo } from "./types";

const DAY = /^\d{4}-\d{2}-\d{2}$/;
const TZ = "Asia/Jerusalem";

export function jerusalemToday(now = new Date()) {
  return new Intl.DateTimeFormat("en-CA", { timeZone: TZ }).format(now);
}

export function promoActive(promo: EntrancePromo | null | undefined, memberId: string, now = new Date()) {
  if (!promo?.id || !promo.imageUrl || !DAY.test(promo.until)) return false;
  if (jerusalemToday(now) > promo.until) return false;
  return !promo.dismissedBy.includes(memberId);
}

export function publicEntrancePromo(promo: EntrancePromo | null | undefined, memberId: string) {
  if (!promo) return null;
  return {
    ...promo,
    dismissedBy: promo.dismissedBy.includes(memberId) ? [memberId] : [],
  };
}

function safeImageUrl(value: string) {
  const url = value.trim();
  if (url.startsWith("/") && !url.startsWith("//") && !url.includes("\\")) return url;
  try {
    const parsed = new URL(url);
    if (parsed.protocol === "https:" || parsed.protocol === "http:") return url;
  } catch {
    return "";
  }
  return "";
}

export function normalizeEntrancePromo(
  input: { imageUrl?: string; until?: string } | null,
  previous: EntrancePromo | null | undefined,
  memberIds: string[]
): EntrancePromo | null {
  if (!input) return null;
  const imageUrl = safeImageUrl(input.imageUrl ?? "");
  const until = (input.until ?? "").trim();
  if (!imageUrl || !DAY.test(until) || Number.isNaN(Date.parse(`${until}T12:00:00Z`))) return null;
  const sameImage = previous?.imageUrl === imageUrl && previous.id;
  const known = new Set(memberIds);
  return {
    id: sameImage ? previous.id : crypto.randomUUID(),
    imageUrl,
    until,
    dismissedBy: sameImage ? previous.dismissedBy.filter((id) => known.has(id)) : [],
  };
}
