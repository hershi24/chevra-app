import type { Gathering, RsvpStatus, RsvpVia } from "./types";

export function setMemberRsvp(event: Gathering, memberId: string, status: RsvpStatus, via: RsvpVia) {
  event.rsvps[memberId] = status;
  event.rsvpVia = { ...(event.rsvpVia ?? {}), [memberId]: via };
}

export function rsvpViaOf(event: Gathering, memberId: string): RsvpVia | undefined {
  return event.rsvpVia?.[memberId];
}
