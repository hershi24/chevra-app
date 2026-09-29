import { persistQuietly, readState } from "./store";
import { getServiceSupabase, isSupabaseEnabled } from "./supabase";

export const READS_BASELINE = "*";

export type ChatReads = Record<string, string>;

function missingSchema(error: { code?: string; message?: string } | null) {
  if (!error) return false;
  if (error.code === "42P01" || error.code === "PGRST205" || error.code === "PGRST204") return true;
  return /chat_reads|schema cache/i.test(error.message ?? "");
}

async function loadCloud(memberId: string): Promise<ChatReads | null> {
  if (!isSupabaseEnabled()) return null;
  const db = getServiceSupabase();
  if (!db) return null;
  const { data, error } = await db
    .from("chat_reads")
    .select("channel_id, read_at")
    .eq("member_id", memberId);
  if (error) {
    if (missingSchema(error)) return null;
    throw error;
  }
  const reads: ChatReads = {};
  for (const row of data ?? []) reads[row.channel_id as string] = new Date(row.read_at as string).toISOString();
  return reads;
}

async function saveCloud(memberId: string, channelId: string, at: string): Promise<boolean> {
  if (!isSupabaseEnabled()) return false;
  const db = getServiceSupabase();
  if (!db) return false;
  const { error } = await db
    .from("chat_reads")
    .upsert({ member_id: memberId, channel_id: channelId, read_at: at });
  if (!error) return true;
  if (missingSchema(error)) return false;
  throw error;
}

async function saveLocal(memberId: string, channelId: string, at: string) {
  await persistQuietly((state) => {
    const all = (state.chatReads ??= {});
    const mine = (all[memberId] ??= {});
    if (mine[channelId] && mine[channelId] >= at) return false;
    mine[channelId] = at;
    return true;
  });
}

export async function markChannelRead(memberId: string, channelId: string, at = new Date().toISOString()) {
  if (!(await saveCloud(memberId, channelId, at))) await saveLocal(memberId, channelId, at);
  return at;
}

/** Messages older than the baseline count as read, so a first visit doesn't flag the whole history. */
export async function loadChatReads(memberId: string): Promise<ChatReads> {
  const cloud = await loadCloud(memberId);
  const reads = cloud ?? { ...((await readState()).chatReads?.[memberId] ?? {}) };
  if (!reads[READS_BASELINE]) {
    reads[READS_BASELINE] = await markChannelRead(memberId, READS_BASELINE);
  }
  return reads;
}

export async function channelReadAt(memberId: string, channelId: string): Promise<string | null> {
  const cloud = await loadCloud(memberId);
  const reads = cloud ?? (await readState()).chatReads?.[memberId] ?? {};
  return reads[channelId] ?? null;
}
