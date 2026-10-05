import { getServiceSupabase, isSupabaseEnabled } from "./supabase";
import type { AppState, CommunityBoard } from "./types";

type DbError = { code?: string; message?: string } | null;

function missingSchema(error: DbError) {
  if (!error) return false;
  if (error.code === "42P01" || error.code === "PGRST205" || error.code === "PGRST204") return true;
  return /site_board|schema cache/i.test(error.message ?? "");
}

export async function loadSiteBoard(): Promise<CommunityBoard | undefined> {
  if (!isSupabaseEnabled()) return undefined;
  const db = getServiceSupabase();
  if (!db) return undefined;
  const { data, error } = await db.from("site_board").select("board").eq("id", 1).maybeSingle();
  if (error) {
    if (missingSchema(error)) return undefined;
    throw error;
  }
  if (!data || !data.board || typeof data.board !== "object") return undefined;
  return data.board as CommunityBoard;
}

export async function syncSiteBoard(before: AppState, after: AppState) {
  if (!isSupabaseEnabled()) return;
  if (JSON.stringify(before.settings.communityBoard ?? null) === JSON.stringify(after.settings.communityBoard ?? null)) {
    return;
  }
  const db = getServiceSupabase();
  if (!db) return;
  const { error } = await db.from("site_board").upsert({
    id: 1,
    board: after.settings.communityBoard ?? { enabled: false },
  });
  if (!error) return;
  if (missingSchema(error)) {
    console.error("site_board table missing; kept local copy");
    return;
  }
  throw error;
}
