import { publicMember } from "./password";
import { readSignedToken } from "./rsvp-link";
import { readState, updateState } from "./store";
import type { Gathering, Member, RsvpStatus } from "./types";

export type RsvpResult = {
  ok: true;
  status: RsvpStatus;
  event: Gathering;
  member: Member;
};

function tokenRow(state: Awaited<ReturnType<typeof readState>>, token: string) {
  const stored = state.tokens.find((item) => item.token === token);
  if (stored) return stored;
  const signed = readSignedToken(token);
  if (!signed) return null;
  return { token, memberId: signed.memberId, eventId: signed.eventId };
}

export async function readRsvp(token: string): Promise<RsvpResult | null> {
  const state = await readState();
  const row = tokenRow(state, token);
  if (!row) return null;
  const event = state.gatherings.find((item) => item.id === row.eventId);
  const member = state.members.find((item) => item.id === row.memberId);
  if (!event || !member) return null;
  return { ok: true, status: event.rsvps[row.memberId] ?? "pending", event, member: publicMember(member) };
}

export async function applyRsvp(token: string, choice: RsvpStatus): Promise<RsvpResult | null> {
  const updated = await updateState((state) => {
    const row = tokenRow(state, token);
    if (!row) throw new Error("missing");
    const event = state.gatherings.find((item) => item.id === row.eventId);
    if (!event) throw new Error("missing-event");
    event.rsvps[row.memberId] = choice;
  }).catch((error: unknown) => {
    if (error instanceof Error && (error.message === "missing" || error.message === "missing-event")) {
      return null;
    }
    throw error;
  });
  if (!updated) return null;
  const row = tokenRow(updated, token);
  const event = row ? updated.gatherings.find((item) => item.id === row.eventId) : undefined;
  const member = row ? updated.members.find((item) => item.id === row.memberId) : undefined;
  if (!row || !event || !member) return null;
  return { ok: true, status: choice, event, member: publicMember(member) };
}
