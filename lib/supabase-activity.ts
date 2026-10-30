import { getServiceSupabase, isSupabaseEnabled } from "./supabase";
import type { AppState, IvrLog, SiteVisit } from "./types";
import { mergeCalls, mergeVisits, settleVisits } from "./visits";

type DbError = { code?: string; message?: string } | null;

function missingSchema(error: DbError) {
  if (!error) return false;
  if (error.code === "42P01" || error.code === "PGRST205" || error.code === "PGRST204") return true;
  return /site_activity|schema cache/i.test(error.message ?? "");
}

function asVisits(value: unknown): SiteVisit[] {
  if (!Array.isArray(value)) return [];
  return value.filter((item): item is SiteVisit => {
    if (!item || typeof item !== "object") return false;
    const visit = item as SiteVisit;
    return typeof visit.id === "string" && typeof visit.memberId === "string" && typeof visit.startedAt === "string";
  });
}

function asCalls(value: unknown): IvrLog[] {
  if (!Array.isArray(value)) return [];
  return value.filter((item): item is IvrLog => {
    if (!item || typeof item !== "object") return false;
    const entry = item as IvrLog;
    return typeof entry.id === "string" && typeof entry.at === "string" && typeof entry.phone === "string";
  });
}

export async function loadSiteActivity(): Promise<{ visits: SiteVisit[]; calls: IvrLog[] } | undefined> {
  if (!isSupabaseEnabled()) return undefined;
  const db = getServiceSupabase();
  if (!db) return undefined;
  const { data, error } = await db.from("site_activity").select("data").eq("id", 1).maybeSingle();
  if (error) {
    if (missingSchema(error)) return undefined;
    throw error;
  }
  if (!data?.data || typeof data.data !== "object") return undefined;
  const payload = data.data as { visits?: unknown; calls?: unknown };
  return { visits: asVisits(payload.visits), calls: asCalls(payload.calls) };
}

export async function syncSiteActivity(before: AppState, after: AppState) {
  if (!isSupabaseEnabled()) return;
  const visits = settleVisits(after.visits ?? []).slice(0, 200);
  const calls = (after.ivrLog ?? []).slice(0, 200);
  if (
    JSON.stringify(before.visits ?? []) === JSON.stringify(visits) &&
    JSON.stringify((before.ivrLog ?? []).slice(0, 200)) === JSON.stringify(calls)
  ) {
    return;
  }
  const db = getServiceSupabase();
  if (!db) return;
  const { error } = await db.from("site_activity").upsert({ id: 1, data: { visits, calls } });
  if (!error) return;
  if (missingSchema(error)) {
    console.error("site_activity table missing; kept local copy");
    return;
  }
  throw error;
}

export function applySiteActivity(
  state: AppState,
  activity: { visits: SiteVisit[]; calls: IvrLog[] } | undefined,
  online: ReadonlySet<string> = new Set()
) {
  if (!activity) {
    state.visits = settleVisits(state.visits ?? [], Date.now(), online);
    return;
  }
  state.visits = settleVisits(mergeVisits(state.visits ?? [], activity.visits), Date.now(), online);
  state.ivrLog = mergeCalls(state.ivrLog ?? [], activity.calls);
}
