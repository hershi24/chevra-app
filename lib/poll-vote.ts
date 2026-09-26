import { castVote, findPollMessage } from "./poll";
import { readPollVote } from "./poll-link";
import { readState, updateState } from "./store";

export async function applyPollLink(token: string) {
  const parsed = readPollVote(token);
  if (!parsed) return { error: "קישור לא תקין" as const };
  const state = await readState();
  const existing = findPollMessage(state, parsed.messageId);
  if (!existing?.poll) return { error: "הסקר לא נמצא" as const };
  if (existing.poll.closed) return { error: "הסקר נסגר" as const };
  const option = existing.poll.options.find((item) => item.id === parsed.optionId);
  if (!option) return { error: "האפשרות לא נמצאה" as const };
  const member = state.members.find((item) => item.id === parsed.memberId);
  if (!member) return { error: "קישור לא תקין" as const };
  await updateState((current) => {
    const message = findPollMessage(current, parsed.messageId);
    if (!message?.poll) throw new Error("הסקר לא נמצא");
    castVote(message.poll, parsed.memberId, parsed.optionId);
  });
  return { question: existing.poll.question, choice: option.label, name: member.displayName };
}
