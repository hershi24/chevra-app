import type { Gathering, RsvpStatus, RsvpVia } from "./types";

type ViaEvent = {
  id: string;
  rsvps: Record<string, RsvpStatus>;
  rsvpVia?: Record<string, RsvpVia>;
};

export function setMemberRsvp(event: Gathering, memberId: string, status: RsvpStatus, via: RsvpVia) {
  event.rsvps[memberId] = status;
  event.rsvpVia = { ...(event.rsvpVia ?? {}), [memberId]: via };
}

/** Keep a known source when a fresh copy has the same answer but lost where it came from. */
export function preserveRsvpVia<T extends ViaEvent>(local: T[], incoming: T[]): T[] {
  const previous = new Map(local.map((event) => [event.id, event]));
  return incoming.map((event) => {
    const prior = previous.get(event.id);
    if (!prior?.rsvpVia) return event;
    const rsvpVia = { ...(event.rsvpVia ?? {}) };
    let added = false;
    for (const [memberId, via] of Object.entries(prior.rsvpVia)) {
      if (rsvpVia[memberId]) continue;
      if (!event.rsvps[memberId] || event.rsvps[memberId] !== prior.rsvps[memberId]) continue;
      rsvpVia[memberId] = via;
      added = true;
    }
    return added ? { ...event, rsvpVia } : event;
  });
}

export function rsvpViaOf(event: Gathering, memberId: string): RsvpVia | undefined {
  return event.rsvpVia?.[memberId];
}
