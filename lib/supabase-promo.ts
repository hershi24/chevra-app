import { getServiceSupabase, isSupabaseEnabled } from "./supabase";
import type { AppState, EntrancePromo } from "./types";

type DbError = { code?: string; message?: string } | null;

function missingSchema(error: DbError) {
  if (!error) return false;
  if (error.code === "42P01" || error.code === "PGRST205" || error.code === "PGRST204") return true;
  return /site_promo|schema cache/i.test(error.message ?? "");
}

export async function loadSitePromo(): Promise<EntrancePromo | null | undefined> {
  if (!isSupabaseEnabled()) return undefined;
  const db = getServiceSupabase();
  if (!db) return undefined;
  const { data, error } = await db.from("site_promo").select("data").eq("id", 1).maybeSingle();
  if (error) {
    if (missingSchema(error)) return undefined;
    throw error;
  }
  if (!data) return undefined;
  if (!data.data || typeof data.data !== "object" || !("imageUrl" in data.data)) return null;
  const promo = data.data as EntrancePromo;
  if (!Array.isArray(promo.dismissedBy)) promo.dismissedBy = [];
  return promo;
}

export async function syncSitePromo(before: AppState, after: AppState) {
  if (!isSupabaseEnabled()) return;
  if (JSON.stringify(before.settings.entrancePromo ?? null) === JSON.stringify(after.settings.entrancePromo ?? null)) {
    return;
  }
  const db = getServiceSupabase();
  if (!db) return;
  const { error } = await db.from("site_promo").upsert({
    id: 1,
    data: after.settings.entrancePromo ?? {},
  });
  if (!error) return;
  if (missingSchema(error)) {
    console.error("site_promo table missing; kept local copy");
    return;
  }
  throw error;
}
