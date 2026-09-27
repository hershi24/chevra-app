import { normalizeExpenses } from "./expenses";
import { getServiceSupabase, isSupabaseEnabled } from "./supabase";
import type { AppState, Expense } from "./types";

function missingSchema(error: { code?: string; message?: string } | null) {
  if (!error) return false;
  if (error.code === "42P01" || error.code === "PGRST205" || error.code === "PGRST204") return true;
  return /expense_ledger|schema cache/i.test(error.message ?? "");
}

export async function loadExpenseLedger(): Promise<{ visible: boolean; items: Expense[] } | null> {
  if (!isSupabaseEnabled()) return null;
  const db = getServiceSupabase();
  if (!db) return null;
  const { data, error } = await db.from("expense_ledger").select("visible, items").eq("id", 1).maybeSingle();
  if (error) {
    if (missingSchema(error)) return null;
    throw error;
  }
  if (!data) return null;
  return {
    visible: data.visible !== false,
    items: normalizeExpenses(data.items),
  };
}

export async function syncExpenseLedger(before: AppState, after: AppState) {
  if (!isSupabaseEnabled()) return;
  const beforeVisible = before.settings.showExpenses !== false;
  const afterVisible = after.settings.showExpenses !== false;
  const sameItems = JSON.stringify(before.expenses ?? []) === JSON.stringify(after.expenses ?? []);
  if (beforeVisible === afterVisible && sameItems) return;
  const db = getServiceSupabase();
  if (!db) return;
  const { error } = await db.from("expense_ledger").upsert({
    id: 1,
    visible: afterVisible,
    items: after.expenses ?? [],
  });
  if (!error) return;
  if (missingSchema(error)) {
    console.error("expense ledger table missing; kept local copy");
    return;
  }
  throw error;
}
