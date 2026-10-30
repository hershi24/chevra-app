import { memberById } from "./format";
import { upcomingGathering } from "./selectors";
import type { Gathering, Member } from "./types";

type RosterState = {
  members: Member[];
  gatherings: Gathering[];
  settings: { kibudRotation?: string[] };
};

export function kibudOrder(state: RosterState) {
  const known = new Set(state.members.map((member) => member.id));
  return (state.settings.kibudRotation ?? []).filter((id, index, list) => known.has(id) && list.indexOf(id) === index);
}

function inOrder(state: RosterState, order: string[], event?: Gathering | null) {
  return state.gatherings
    .filter((item) => item.status !== "cancelled" && item.kibudId && order.includes(item.kibudId))
    .filter((item) => !event || item.id !== event.id)
    .filter((item) => !event || +new Date(item.startsAt) <= +new Date(event.startsAt))
    .sort((a, b) => +new Date(b.startsAt) - +new Date(a.startsAt))[0];
}

function lastAssigned(state: RosterState, order: string[]) {
  return state.gatherings
    .filter((event) => event.status !== "cancelled" && event.kibudId && order.includes(event.kibudId))
    .sort((a, b) => +new Date(b.startsAt) - +new Date(a.startsAt))[0];
}

function after(order: string[], id: string | undefined) {
  if (!order.length) return undefined;
  if (!id || !order.includes(id)) return order[0];
  return order[(order.indexOf(id) + 1) % order.length];
}

/** Who should bring the refreshments for a gathering that does not have one yet. */
export function suggestedKibudId(state: RosterState) {
  const order = kibudOrder(state);
  if (!order.length) return undefined;
  const upcoming = upcomingGathering(state);
  if (upcoming?.kibudId && order.includes(upcoming.kibudId)) return after(order, upcoming.kibudId);
  return after(order, lastAssigned(state, order)?.kibudId);
}

export function kibudTurn(state: RosterState, event?: Gathering | null) {
  const order = kibudOrder(state);
  const duty = memberById(state.members, event?.kibudId);
  const upcoming = upcomingGathering(state);
  const onDeck = Boolean(event && upcoming?.id === event.id);
  if (!order.length || !onDeck) return { duty, next: undefined as Member | undefined, suggested: undefined as Member | undefined };
  const anchor = duty && order.includes(duty.id) ? duty.id : inOrder(state, order, event)?.kibudId;
  const next = memberById(state.members, after(order, anchor));
  return { duty, next: next && next.id !== duty?.id ? next : undefined, suggested: undefined };
}
