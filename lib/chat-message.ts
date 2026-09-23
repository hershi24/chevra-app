import type { Message } from "./types";

export type MessageRow = {
  id: string;
  channel_id: string;
  author_id: string | null;
  text: string;
  quote: Message["quote"] | null;
  attachments: Message["attachments"] | null;
  voice_url: string | null;
  mentions: string[] | null;
  created_at: string;
};

export type ReactionRow = {
  message_id: string;
  emoji: string;
  member_id: string;
};

export function messageFromRow(row: MessageRow, reactions: Record<string, string[]> = {}): Message {
  return {
    id: row.id,
    channelId: row.channel_id,
    authorId: row.author_id ?? "",
    text: row.text ?? "",
    createdAt: row.created_at,
    quote: row.quote ?? undefined,
    reactions,
    attachments: row.attachments ?? [],
    voiceUrl: row.voice_url ?? undefined,
    mentions: row.mentions ?? [],
  };
}

export function removeMessage(messages: Message[], messageId: string): Message[] {
  return messages.filter((item) => item.id !== messageId);
}

export function upsertMessage(messages: Message[], incoming: Message): Message[] {
  const index = messages.findIndex((item) => item.id === incoming.id);
  if (index === -1) return [...messages, incoming];
  const next = messages.slice();
  next[index] = { ...incoming, reactions: messages[index].reactions };
  return next;
}

export function applyReaction(
  messages: Message[],
  row: ReactionRow,
  action: "INSERT" | "UPDATE" | "DELETE"
): Message[] {
  return messages.map((message) => {
    if (message.id !== row.message_id) return message;
    const ids = new Set(message.reactions[row.emoji] ?? []);
    if (action === "DELETE") ids.delete(row.member_id);
    else ids.add(row.member_id);
    const reactions = { ...message.reactions };
    if (ids.size === 0) delete reactions[row.emoji];
    else reactions[row.emoji] = [...ids];
    return { ...message, reactions };
  });
}
