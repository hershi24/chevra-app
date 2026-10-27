import { memberHasPhone } from "./phone";
import type { AppState, Gathering, Member, NudgeSettings, NudgeState } from "./types";

export const NUDGE_EVERY_OPTIONS = [12, 24, 48, 72];

export function defaultNudgeSettings(): NudgeSettings {
  return { enabled: false, everyHours: 24, maxPerMember: 3, includeMaybe: false };
}

export function normalizeNudgeSettings(raw: unknown): NudgeSettings {
  const base = defaultNudgeSettings();
  const value = raw && typeof raw === "object" ? (raw as Partial<NudgeSettings>) : {};
  const every = Number(value.everyHours);
  const max = Math.round(Number(value.maxPerMember));
  return {
    enabled: value.enabled === true,
    everyHours: NUDGE_EVERY_OPTIONS.includes(every) ? every : base.everyHours,
    maxPerMember: Number.isFinite(max) ? Math.min(Math.max(max, 1), 10) : base.maxPerMember,
    includeMaybe: value.includeMaybe === true,
  };
}

export function nudgeState(state: Pick<AppState, "nudge">): NudgeState {
  return {
    settings: normalizeNudgeSettings(state.nudge?.settings),
    events: state.nudge?.events ?? {},
  };
}

export function memberAddress(member: Member) {
  const address = member.email?.trim() ?? "";
  if (!address || address.endsWith("@chevra.local")) return "";
  return address;
}

export function waitingOn(event: Gathering, member: Member, settings: NudgeSettings) {
  const status = event.rsvps[member.id] ?? "pending";
  return status === "pending" || (settings.includeMaybe && status === "maybe");
}

export function reachableForNudge(member: Member) {
  return Boolean(memberAddress(member) || memberHasPhone(member));
}
