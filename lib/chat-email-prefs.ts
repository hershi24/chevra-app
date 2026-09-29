import { canSeeChannel } from "./channels";
import { getServiceSupabase, isSupabaseEnabled } from "./supabase";
import type { AppState, Channel, ChatEmailPrefs, Member } from "./types";

export const CHAT_EMAIL_OFF: ChatEmailPrefs = { mode: "off", dm: true, channelIds: [] };

export function normalizeChatEmailPrefs(value: unknown): ChatEmailPrefs {
  if (!value || typeof value !== "object") return CHAT_EMAIL_OFF;
  const raw = value as Partial<ChatEmailPrefs>;
  const mode = raw.mode === "dm" || raw.mode === "custom" ? raw.mode : "off";
  const channelIds = Array.isArray(raw.channelIds)
    ? [...new Set(raw.channelIds.filter((id): id is string => typeof id === "string"))]
    : [];
  return { mode, dm: raw.dm !== false, channelIds };
}

export function chatEmailPrefsFor(state: Pick<AppState, "chatEmailPrefs">, memberId: string) {
  return normalizeChatEmailPrefs(state.chatEmailPrefs?.[memberId]);
}

export function wantsChatEmail(prefs: ChatEmailPrefs, channel: Channel) {
  if (prefs.mode === "off") return false;
  if (channel.type === "dm") return prefs.mode === "dm" || prefs.dm;
  return prefs.mode === "custom" && prefs.channelIds.includes(channel.id);
}

export function hasRealEmail(member: Member) {
  const address = member.email?.trim() ?? "";
  return Boolean(address) && !address.endsWith("@chevra.local");
}

export function chatEmailRecipients(state: AppState, channel: Channel, authorId: string) {
  return state.members.filter(
    (member) =>
      member.id !== authorId &&
      hasRealEmail(member) &&
      canSeeChannel(member, channel) &&
      wantsChatEmail(chatEmailPrefsFor(state, member.id), channel)
  );
}

type DbError = { code?: string; message?: string } | null;

function missingTable(error: DbError) {
  if (!error) return false;
  if (error.code === "42P01" || error.code === "PGRST205") return true;
  return /member_chat_email_prefs|schema cache/i.test(error.message ?? "");
}

export async function loadChatEmailPrefs(): Promise<Record<string, ChatEmailPrefs> | null> {
  if (!isSupabaseEnabled()) return null;
  const db = getServiceSupabase();
  if (!db) return null;
  const { data, error } = await db.from("member_chat_email_prefs").select("member_id, prefs");
  if (error) {
    if (missingTable(error)) {
      console.error("member_chat_email_prefs table missing; run the migration in Supabase");
      return null;
    }
    throw error;
  }
  const prefs: Record<string, ChatEmailPrefs> = {};
  for (const row of data ?? []) {
    if (typeof row.member_id === "string") prefs[row.member_id] = normalizeChatEmailPrefs(row.prefs);
  }
  return prefs;
}

export async function syncChatEmailPrefs(before: AppState, after: AppState) {
  if (!isSupabaseEnabled()) return;
  const prev = before.chatEmailPrefs ?? {};
  const next = after.chatEmailPrefs ?? {};
  const changed = Object.keys(next).filter((id) => JSON.stringify(prev[id]) !== JSON.stringify(next[id]));
  const removed = Object.keys(prev).filter((id) => !next[id]);
  if (!changed.length && !removed.length) return;
  const db = getServiceSupabase();
  if (!db) return;
  if (changed.length) {
    const { error } = await db.from("member_chat_email_prefs").upsert(
      changed.map((id) => ({ member_id: id, prefs: next[id], updated_at: new Date().toISOString() }))
    );
    if (error) {
      if (missingTable(error)) {
        console.error("member_chat_email_prefs table missing; run the migration in Supabase");
      }
      throw error;
    }
  }
  if (removed.length) {
    const { error } = await db.from("member_chat_email_prefs").delete().in("member_id", removed);
    if (error && !missingTable(error)) throw error;
  }
}
