import { invitationHtml, nudgeSubject, sendEmail } from "./email";
import { gatheringLabel, memberById } from "./format";
import { signRsvpToken } from "./rsvp-link";
import { readState, updateState } from "./store";
import type { AppState, EmailDelivery, Gathering, Member, NudgeRecord } from "./types";

import { memberAddress, nudgeState, waitingOn } from "./nudge-rules";

export * from "./nudge-rules";

const TZ = "Asia/Jerusalem";
const HOUR = 3_600_000;

/** No automatic sends at night or from Friday afternoon until Saturday night. */
export function quietNow(now = new Date()) {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: TZ,
    weekday: "short",
    hour: "numeric",
    hourCycle: "h23",
  }).formatToParts(now);
  const day = parts.find((part) => part.type === "weekday")?.value ?? "";
  const hour = Number(parts.find((part) => part.type === "hour")?.value ?? 12);
  if (hour < 8 || hour >= 22) return true;
  if (day === "Fri" && hour >= 14) return true;
  if (day === "Sat" && hour < 21) return true;
  return false;
}

type SendOpts = {
  origin: string;
  note?: string;
  senderName?: string;
  variant: "invite" | "nudge";
};

export async function sendGatheringEmail(
  state: AppState,
  event: Gathering,
  member: Member,
  opts: SendOpts
): Promise<EmailDelivery> {
  const address = memberAddress(member);
  if (!address) {
    return {
      to: member.email?.trim() || "—",
      name: member.displayName,
      status: "skipped",
      error: member.email?.trim() ? "כתובת הדגמה לא נשלחת" : "אין כתובת מייל",
    };
  }
  const token = signRsvpToken(member.id, event.id);
  const html = invitationHtml({
    member,
    event,
    hostName: memberById(state.members, event.hostId)?.displayName ?? "",
    kibudName: memberById(state.members, event.kibudId)?.displayName,
    lecturerName: memberById(state.members, event.lecturerId)?.displayName,
    senderName: opts.senderName,
    yesUrl: `${opts.origin}/rsvp/${token}?c=yes`,
    maybeUrl: `${opts.origin}/rsvp/${token}?c=maybe`,
    noUrl: `${opts.origin}/rsvp/${token}?c=no`,
    note: opts.note,
    origin: opts.origin,
    variant: opts.variant,
  });
  const subject = opts.variant === "nudge" ? nudgeSubject(member) : `הזמנה: ${gatheringLabel(event)}`;
  const result = await sendEmail({ to: address, subject, html });
  if ("mock" in result) {
    return { to: address, name: member.displayName, status: "failed", error: "אין מפתח Resend בשרת, המייל לא יצא" };
  }
  return {
    to: address,
    name: member.displayName,
    status: result.ok ? "sent" : "failed",
    error: result.ok ? undefined : result.error || "השליחה נכשלה",
  };
}

export function recordDeliveries(
  state: AppState,
  eventId: string,
  rows: { memberId: string; delivery: EmailDelivery }[],
  variant: "invite" | "nudge",
  at = new Date().toISOString()
) {
  const current = nudgeState(state);
  const events = { ...current.events };
  const forEvent = { ...(events[eventId] ?? {}) };
  for (const { memberId, delivery } of rows) {
    if (delivery.status === "skipped") continue;
    const previous: NudgeRecord = forEvent[memberId] ?? { nudges: 0 };
    const next: NudgeRecord = {
      ...previous,
      lastAt: at,
      lastStatus: delivery.status === "sent" ? "sent" : "failed",
    };
    if (delivery.status === "sent") delete next.lastError;
    else next.lastError = delivery.error || "השליחה נכשלה";
    if (variant === "invite" && delivery.status === "sent") next.invitedAt = at;
    if (variant === "nudge") {
      next.lastNudgeAt = at;
      if (delivery.status === "sent") next.nudges = previous.nudges + 1;
    }
    forEvent[memberId] = next;
  }
  events[eventId] = forEvent;
  const live = new Set(state.gatherings.filter((event) => event.status === "upcoming").map((event) => event.id));
  for (const id of Object.keys(events)) {
    if (!live.has(id)) delete events[id];
  }
  state.nudge = { settings: current.settings, events };
}

export function nextNudgeEvent(state: Pick<AppState, "gatherings">, now = Date.now()) {
  return (
    state.gatherings
      .filter((event) => event.status === "upcoming" && new Date(event.startsAt).getTime() > now + HOUR)
      .sort((a, b) => +new Date(a.startsAt) - +new Date(b.startsAt))[0] ?? null
  );
}

export function dueMembers(state: AppState, now = Date.now()) {
  const { settings, events } = nudgeState(state);
  if (!settings.enabled) return { event: null, members: [] as Member[] };
  const event = nextNudgeEvent(state, now);
  if (!event) return { event: null, members: [] as Member[] };
  const records = events[event.id] ?? {};
  const members = state.members.filter((member) => {
    if (!memberAddress(member) || !waitingOn(event, member, settings)) return false;
    const record = records[member.id];
    if ((record?.nudges ?? 0) >= settings.maxPerMember) return false;
    if (!record?.lastAt) return true;
    return now - new Date(record.lastAt).getTime() >= settings.everyHours * HOUR;
  });
  return { event, members };
}

const g = globalThis as unknown as { __chevraNudgeRun?: Promise<NudgeRunResult>; __chevraOrigin?: string };

export function rememberOrigin(origin: string) {
  if (/^https:\/\//.test(origin)) g.__chevraOrigin = origin;
}

function backgroundOrigin() {
  const fromEnv = (process.env.PUBLIC_SITE_URL || process.env.RENDER_EXTERNAL_URL || "").replace(/\/$/, "");
  return fromEnv || g.__chevraOrigin || "";
}

export type NudgeRunResult = {
  ran: boolean;
  reason?: string;
  eventId?: string;
  deliveries: EmailDelivery[];
};

export function runNudges(origin?: string): Promise<NudgeRunResult> {
  g.__chevraNudgeRun ??= runOnce(origin).finally(() => {
    g.__chevraNudgeRun = undefined;
  });
  return g.__chevraNudgeRun;
}

async function runOnce(originArg?: string): Promise<NudgeRunResult> {
  if (quietNow()) return { ran: false, reason: "שעות שקטות", deliveries: [] };
  const state = await readState();
  const { event, members } = dueMembers(state);
  if (!event || !members.length) return { ran: false, reason: "אין למי לשלוח", deliveries: [] };
  const origin = originArg || backgroundOrigin();
  if (!origin) return { ran: false, reason: "חסרה כתובת האתר (PUBLIC_SITE_URL)", deliveries: [] };

  const rows: { memberId: string; delivery: EmailDelivery }[] = [];
  for (const member of members) {
    const delivery = await sendGatheringEmail(state, event, member, { origin, variant: "nudge" });
    rows.push({ memberId: member.id, delivery });
  }
  await updateState((s) => {
    recordDeliveries(s, event.id, rows, "nudge");
  });
  return { ran: true, eventId: event.id, deliveries: rows.map((row) => row.delivery) };
}
