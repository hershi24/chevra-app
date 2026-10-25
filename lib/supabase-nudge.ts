import { getServiceSupabase, isSupabaseEnabled } from "./supabase";
import type { AppState, NudgeState } from "./types";

type DbError = { code?: string; message?: string } | null;

function missingSchema(error: DbError) {
  if (!error) return false;
  if (error.code === "42P01" || error.code === "PGRST205" || error.code === "PGRST204") return true;
  return /site_nudge|schema cache/i.test(error.message ?? "");
}

export async function loadSiteNudge(): Promise<NudgeState | undefined> {
  if (!isSupabaseEnabled()) return undefined;
  const db = getServiceSupabase();
  if (!db) return undefined;
  const { data, error } = await db.from("site_nudge").select("data").eq("id", 1).maybeSingle();
  if (error) {
    if (missingSchema(error)) return undefined;
    throw error;
  }
  if (!data || !data.data || typeof data.data !== "object" || !("settings" in data.data)) return undefined;
  return data.data as NudgeState;
}

export async function syncSiteNudge(before: AppState, after: AppState) {
  if (!isSupabaseEnabled()) return;
  if (JSON.stringify(before.nudge ?? null) === JSON.stringify(after.nudge ?? null)) return;
  if (!after.nudge) return;
  const db = getServiceSupabase();
  if (!db) return;
  const { error } = await db.from("site_nudge").upsert({ id: 1, data: after.nudge });
  if (!error) return;
  if (missingSchema(error)) {
    console.error("site_nudge table missing; kept local copy");
    return;
  }
  throw error;
}
