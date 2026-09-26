import { canSeeChannel, isGeneralChannel, isRoshChevra } from "./channels";
import type { AppState, Channel, Member, Message, Poll } from "./types";

export function findPollMessage(state: AppState, messageId: string) {
  return state.messages.find((message) => message.id === messageId && message.poll);
}

export function canAccessPoll(user: Member, channel: Channel) {
  if (canSeeChannel(user, channel)) return true;
  return isRoshChevra(user) && isGeneralChannel(channel);
}

export function castVote(poll: Poll, memberId: string, optionId: string) {
  if (poll.closed) throw new Error("הסקר נסגר");
  const option = poll.options.find((item) => item.id === optionId);
  if (!option) throw new Error("האפשרות לא נמצאה");
  for (const item of poll.options) {
    item.voterIds = item.voterIds.filter((id) => id !== memberId);
  }
  option.voterIds.push(memberId);
}

export function pollVoters(members: Member[], ids: string[]) {
  return ids
    .map((id) => members.find((member) => member.id === id)?.displayName)
    .filter((name): name is string => Boolean(name));
}

export function pollChanged(before: Message, after: Message) {
  return JSON.stringify(before.poll ?? null) !== JSON.stringify(after.poll ?? null);
}
