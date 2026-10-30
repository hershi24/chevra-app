import { cancellationHtml, cancelSubject, invitationHtml, nudgeSubject, sendEmail } from "./email";
import { gatheringLabel, memberById } from "./format";
import { signRsvpToken } from "./rsvp-link";
import { readState, updateState } from "./store";
import type { AppState, EmailDelivery, Gathering, IvrLog, Member, NudgeRecord } from "./types";

import { memberHasPhone } from "./phone";
import { sendExtensionTzintuk, yemotConfigured, type TzintukResult } from "./yemot";
import { memberAddress, nudgeState, reachableForNudge, waitingOn } from "./nudge-rules";

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
  variant: "invite" | "nudge" | "cancel";
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
  const html =
    opts.variant === "cancel"
      ? cancellationHtml({
          member,
          event,
          hostName: memberById(state.members, event.hostId)?.displayName ?? "",
          kibudName: memberById(state.members, event.kibudId)?.displayName,
          lecturerName: memberById(state.members, event.lecturerId)?.displayName,
          senderName: opts.senderName,
          note: opts.note,
          origin: opts.origin,
        })
      : invitationHtml({
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
          variant: opts.variant === "nudge" ? "nudge" : "invite",
        });
  const subject =
    opts.variant === "cancel"
      ? cancelSubject(event)
      : opts.variant === "nudge"
        ? nudgeSubject(member)
        : `הזמנה: ${gatheringLabel(event)}`;
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

export function mergeNudgeRows(
  emailRows: { memberId: string; delivery: EmailDelivery }[],
  calls: { memberId: string; phone: string; ok: boolean; skipped?: boolean; error?: string }[],
  nameOf: (id: string) => string
) {
  const emails = new Map(emailRows.map((row) => [row.memberId, row.delivery]));
  const dials = new Map(calls.filter((row) => !row.skipped).map((row) => [row.memberId, row]));
  const ids = new Set([...emails.keys(), ...dials.keys()]);
  const rows: { memberId: string; delivery: EmailDelivery }[] = [];
  for (const memberId of ids) {
    const email = emails.get(memberId);
    const call = dials.get(memberId);
    if (email?.status === "sent") rows.push({ memberId, delivery: email });
    else if (call?.ok) {
      rows.push({
        memberId,
        delivery: { to: call.phone, name: nameOf(memberId), status: "sent" },
      });
    } else if (email && email.status !== "skipped") rows.push({ memberId, delivery: email });
    else if (call) {
      rows.push({
        memberId,
        delivery: {
          to: call.phone,
          name: nameOf(memberId),
          status: "failed",
          error: call.error,
        },
      });
    }
  }
  return rows;
}

type NudgeCall = { memberId: string; phone: string; ok: boolean; skipped?: boolean; error?: string };

/** One free ring on extension 5, counted as a nudge for each waiting member who has a phone. */
export async function ringNudgeList(members: Member[]): Promise<{ ring: TzintukResult | null; calls: NudgeCall[] }> {
  const targets = members.filter((member) => memberHasPhone(member));
  if (!targets.length || !yemotConfigured()) return { ring: null, calls: [] };
  const ring = await sendExtensionTzintuk();
  return {
    ring,
    calls: targets.map((member) => ({
      memberId: member.id,
      phone: member.phone.trim(),
      ok: ring.ok,
      skipped: ring.skipped,
      error: ring.error,
    })),
  };
}

export function logNudgeRing(state: AppState, eventId: string, ring: TzintukResult, at = new Date().toISOString()) {
  const entry: IvrLog = {
    id: crypto.randomUUID(),
    at,
    phone: ring.phone,
    action: "tzintuk",
    eventId,
    result: ring.ok ? "tzintuk_sent" : ring.error || "tzintuk_failed",
  };
  state.ivrLog.unshift(entry);
}

export function recordDeliveries(
  state: AppState,
  eventId: string,
  rows: { memberId: string; delivery: EmailDelivery }[],
  variant: "invite" | "nudge" | "cancel",
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
    if (!reachableForNudge(member) || !waitingOn(event, member, settings)) return false;
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
  const canCall = yemotConfigured() && members.some((member) => memberHasPhone(member));
  if (!origin && !canCall) return { ran: false, reason: "חסרה כתובת האתר (PUBLIC_SITE_URL)", deliveries: [] };

  const rows: { memberId: string; delivery: EmailDelivery }[] = [];
  for (const member of members) {
    if (origin && memberAddress(member)) {
      const delivery = await sendGatheringEmail(state, event, member, { origin, variant: "nudge" });
      rows.push({ memberId: member.id, delivery });
    }
  }
  const { ring, calls } = await ringNudgeList(members);
  if (!rows.length && !calls.length) {
    return { ran: false, reason: origin ? "אין למי לשלוח" : "חסרה כתובת האתר (PUBLIC_SITE_URL)", deliveries: [] };
  }
  const combined = mergeNudgeRows(rows, calls, (id) => memberById(state.members, id)?.displayName ?? id);
  await updateState((s) => {
    recordDeliveries(s, event.id, combined, "nudge");
    if (ring) logNudgeRing(s, event.id, ring);
  });
  return { ran: true, eventId: event.id, deliveries: combined.map((row) => row.delivery) };
}
