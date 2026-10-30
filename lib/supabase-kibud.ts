import { getServiceSupabase, isSupabaseEnabled } from "./supabase";
import type { AppState } from "./types";

type DbError = { code?: string; message?: string } | null;

function missingSchema(error: DbError) {
  if (!error) return false;
  if (error.code === "42P01" || error.code === "PGRST205" || error.code === "PGRST204") return true;
  return /site_kibud|schema cache/i.test(error.message ?? "");
}

export async function loadSiteKibud(): Promise<string[] | undefined> {
  if (!isSupabaseEnabled()) return undefined;
  const db = getServiceSupabase();
  if (!db) return undefined;
  const { data, error } = await db.from("site_kibud").select("data").eq("id", 1).maybeSingle();
  if (error) {
    if (missingSchema(error)) return undefined;
    throw error;
  }
  if (!data) return undefined;
  const order = data.data && typeof data.data === "object" && "order" in data.data ? data.data.order : [];
  return Array.isArray(order) ? order.filter((id): id is string => typeof id === "string") : [];
}

export async function syncSiteKibud(before: AppState, after: AppState) {
  if (!isSupabaseEnabled()) return;
  const previous = before.settings.kibudRotation ?? [];
  const next = after.settings.kibudRotation ?? [];
  if (JSON.stringify(previous) === JSON.stringify(next)) return;
  const db = getServiceSupabase();
  if (!db) return;
  const { error } = await db.from("site_kibud").upsert({ id: 1, data: { order: next } });
  if (!error) return;
  if (missingSchema(error)) {
    console.error("site_kibud table missing; kept local copy");
    return;
  }
  throw error;
}
