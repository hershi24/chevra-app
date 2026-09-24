import { messageFromRow, type MessageRow, type ReactionRow } from "./chat-message";
import { getServiceSupabase, isSupabaseEnabled } from "./supabase";
import type { AppState, Channel, Member, Message } from "./types";

function reactionsMap(rows: ReactionRow[]): Record<string, Record<string, string[]>> {
  const byMessage: Record<string, Record<string, string[]>> = {};
  for (const row of rows) {
    const current = byMessage[row.message_id] ?? {};
    current[row.emoji] = [...(current[row.emoji] ?? []), row.member_id];
    byMessage[row.message_id] = current;
  }
  return byMessage;
}

function memberRow(member: Member) {
  return {
    id: member.id,
    username: member.username,
    display_name: member.displayName,
    role: member.role,
    phone: member.phone || null,
    email: member.email || null,
    avatar_color: member.avatarColor,
    initials: member.initials,
  };
}

function channelRow(channel: Channel) {
  return {
    id: channel.id,
    name: channel.name,
    type: channel.type,
    description: channel.description ?? null,
  };
}

function messageRow(message: Message) {
  return {
    id: message.id,
    channel_id: message.channelId,
    author_id: message.authorId,
    text: message.text,
    quote: message.quote ?? null,
    attachments: message.attachments,
    voice_url: message.voiceUrl ?? null,
    mentions: message.mentions,
    created_at: message.createdAt,
  };
}

export async function loadMembersFromSupabase(): Promise<Member[] | null> {
  const db = getServiceSupabase();
  if (!db) return null;
  const { data, error } = await db.from("members").select("*");
  if (error) throw error;
  return (data ?? []).map((row) => ({
    id: row.id as string,
    username: row.username as string,
    displayName: row.display_name as string,
    role: row.role as Member["role"],
    phone: (row.phone as string | null) ?? "",
    email: (row.email as string | null) ?? "",
    avatarColor: (row.avatar_color as string) || "#0F766E",
    initials: (row.initials as string) || "?",
  }));
}

export async function upsertMembers(members: Member[]) {
  const db = getServiceSupabase();
  if (!db || !members.length) return;
  const { error } = await db.from("members").upsert(members.map(memberRow));
  if (error) throw error;
}

export async function loadChatFromSupabase(): Promise<{
  channels: Channel[];
  messages: Message[];
} | null> {
  const db = getServiceSupabase();
  if (!db) return null;

  const [channelsRes, membersRes, messagesRes, reactionsRes] = await Promise.all([
    db.from("channels").select("*"),
    db.from("channel_members").select("*"),
    db.from("messages").select("*").order("created_at", { ascending: true }),
    db.from("message_reactions").select("*"),
  ]);

  if (channelsRes.error) throw channelsRes.error;
  if (membersRes.error) throw membersRes.error;
  if (messagesRes.error) throw messagesRes.error;
  if (reactionsRes.error) throw reactionsRes.error;

  const membersByChannel = new Map<string, string[]>();
  for (const row of membersRes.data ?? []) {
    const list = membersByChannel.get(row.channel_id) ?? [];
    list.push(row.member_id);
    membersByChannel.set(row.channel_id, list);
  }

  const channels: Channel[] = (channelsRes.data ?? []).map((row) => ({
    id: row.id as string,
    name: row.name as string,
    type: row.type as Channel["type"],
    description: (row.description as string | null) ?? undefined,
    memberIds: membersByChannel.get(row.id as string) ?? [],
  }));

  const byMessage = reactionsMap((reactionsRes.data ?? []) as ReactionRow[]);
  const messages = ((messagesRes.data ?? []) as MessageRow[]).map((row) =>
    messageFromRow(row, byMessage[row.id] ?? {})
  );

  return { channels, messages };
}

export async function bootstrapChatIfEmpty(state: AppState) {
  const db = getServiceSupabase();
  if (!db) return;

  const { count, error } = await db.from("channels").select("*", { count: "exact", head: true });
  if (error) throw error;
  if ((count ?? 0) > 0) return;

  await pushFullChat(state);
}

async function pushFullChat(state: AppState) {
  const db = getServiceSupabase();
  if (!db) return;

  if (state.members.length) {
    const { error } = await db.from("members").upsert(state.members.map(memberRow));
    if (error) throw error;
  }
  if (state.channels.length) {
    const { error } = await db.from("channels").upsert(state.channels.map(channelRow));
    if (error) throw error;
    const links = state.channels.flatMap((channel) =>
      channel.memberIds.map((memberId) => ({ channel_id: channel.id, member_id: memberId }))
    );
    if (links.length) {
      const { error: linkError } = await db.from("channel_members").upsert(links);
      if (linkError) throw linkError;
    }
  }
  if (state.messages.length) {
    const { error } = await db.from("messages").upsert(state.messages.map(messageRow));
    if (error) throw error;
    const reactions = state.messages.flatMap((message) =>
      Object.entries(message.reactions).flatMap(([emoji, ids]) =>
        ids.map((memberId) => ({ message_id: message.id, emoji, member_id: memberId }))
      )
    );
    if (reactions.length) {
      const { error: reactError } = await db.from("message_reactions").upsert(reactions);
      if (reactError) throw reactError;
    }
  }
}

export async function syncChatDiff(before: AppState, after: AppState) {
  if (!isSupabaseEnabled()) return;
  const db = getServiceSupabase();
  if (!db) return;

  const newMembers = after.members.filter((member) => !before.members.some((m) => m.id === member.id));
  const changedMembers = after.members.filter((member) => {
    const prev = before.members.find((m) => m.id === member.id);
    return (
      prev &&
      (prev.role !== member.role ||
        prev.displayName !== member.displayName ||
        prev.username !== member.username ||
        prev.phone !== member.phone ||
        prev.email !== member.email)
    );
  });
  const membersToUpsert = [...newMembers, ...changedMembers];
  if (membersToUpsert.length) {
    const { error } = await db.from("members").upsert(membersToUpsert.map(memberRow));
    if (error) throw error;
  }

  const removedMembers = before.members.filter(
    (member) => !after.members.some((item) => item.id === member.id)
  );
  for (const member of removedMembers) {
    const { error: linkError } = await db.from("channel_members").delete().eq("member_id", member.id);
    if (linkError) throw linkError;
    const { error } = await db.from("members").delete().eq("id", member.id);
    if (error) throw error;
  }

  const removedChannels = before.channels.filter(
    (channel) => !after.channels.some((item) => item.id === channel.id)
  );
  for (const channel of removedChannels) {
    const { error: linkError } = await db.from("channel_members").delete().eq("channel_id", channel.id);
    if (linkError) throw linkError;
    const { error: messageError } = await db.from("messages").delete().eq("channel_id", channel.id);
    if (messageError) throw messageError;
    const { error } = await db.from("channels").delete().eq("id", channel.id);
    if (error) throw error;
  }

  for (const channel of after.channels) {
    const prev = before.channels.find((c) => c.id === channel.id);
    if (!prev) {
      const { error } = await db.from("channels").upsert(channelRow(channel));
      if (error) throw error;
      if (channel.memberIds.length) {
        const { error: linkError } = await db
          .from("channel_members")
          .upsert(channel.memberIds.map((memberId) => ({ channel_id: channel.id, member_id: memberId })));
        if (linkError) throw linkError;
      }
      continue;
    }
    if (
      prev.name !== channel.name ||
      prev.type !== channel.type ||
      prev.description !== channel.description
    ) {
      const { error } = await db.from("channels").update(channelRow(channel)).eq("id", channel.id);
      if (error) throw error;
    }
    const added = channel.memberIds.filter((id) => !prev.memberIds.includes(id));
    if (added.length) {
      const { error } = await db
        .from("channel_members")
        .upsert(added.map((memberId) => ({ channel_id: channel.id, member_id: memberId })));
      if (error) throw error;
    }
    const removedMembers = prev.memberIds.filter((id) => !channel.memberIds.includes(id));
    if (removedMembers.length) {
      const { error } = await db
        .from("channel_members")
        .delete()
        .eq("channel_id", channel.id)
        .in("member_id", removedMembers);
      if (error) throw error;
    }
  }

  const removed = before.messages.filter(
    (message) => !after.messages.some((item) => item.id === message.id)
  );
  for (const message of removed) {
    const { error } = await db.from("messages").delete().eq("id", message.id);
    if (error) throw error;
  }

  for (const message of after.messages) {
    const prev = before.messages.find((m) => m.id === message.id);
    if (!prev) {
      const { error } = await db.from("messages").insert(messageRow(message));
      if (error) throw error;
      continue;
    }
    await syncReactions(prev, message);
  }
}

async function syncReactions(before: Message, after: Message) {
  const db = getServiceSupabase();
  if (!db) return;

  const beforePairs = new Set(
    Object.entries(before.reactions).flatMap(([emoji, ids]) => ids.map((id) => `${emoji}\0${id}`))
  );
  const afterPairs = new Set(
    Object.entries(after.reactions).flatMap(([emoji, ids]) => ids.map((id) => `${emoji}\0${id}`))
  );

  const toAdd = [...afterPairs].filter((pair) => !beforePairs.has(pair));
  const toRemove = [...beforePairs].filter((pair) => !afterPairs.has(pair));

  for (const pair of toAdd) {
    const [emoji, memberId] = pair.split("\0");
    const { error } = await db
      .from("message_reactions")
      .insert({ message_id: after.id, emoji, member_id: memberId });
    if (error) throw error;
  }
  for (const pair of toRemove) {
    const [emoji, memberId] = pair.split("\0");
    const { error } = await db
      .from("message_reactions")
      .delete()
      .eq("message_id", after.id)
      .eq("emoji", emoji)
      .eq("member_id", memberId);
    if (error) throw error;
  }
}
