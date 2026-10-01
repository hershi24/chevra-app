import { normalizeBankAccount, normalizePayments, packLedgerItems, splitLedgerItems } from "./expenses";
import { getServiceSupabase, isSupabaseEnabled } from "./supabase";
import type { AppState, BankAccount, Expense, ExpensePayment, GatheringWaiver } from "./types";

type DbError = { code?: string; message?: string } | null;

function missingSchema(error: DbError) {
  if (!error) return false;
  if (error.code === "42P01" || error.code === "PGRST205" || error.code === "PGRST204") return true;
  return /expense_ledger|member_bank_accounts|schema cache/i.test(error.message ?? "");
}

function missingPaymentsColumn(error: DbError) {
  if (!error) return false;
  if (error.code === "42703" || error.code === "PGRST204") return true;
  return /payments/i.test(error.message ?? "") && /column/i.test(error.message ?? "");
}

export async function loadExpenseLedger(): Promise<{
  visible: boolean;
  items: Expense[];
  waivers: GatheringWaiver[];
  payments: ExpensePayment[] | null;
} | null> {
  if (!isSupabaseEnabled()) return null;
  const db = getServiceSupabase();
  if (!db) return null;
  const full = await db.from("expense_ledger").select("visible, items, payments").eq("id", 1).maybeSingle();
  let data = full.data as { visible?: boolean; items?: unknown; payments?: unknown } | null;
  let error: DbError = full.error;
  let withPayments = true;
  if (error && missingPaymentsColumn(error)) {
    const legacy = await db.from("expense_ledger").select("visible, items").eq("id", 1).maybeSingle();
    data = legacy.data;
    error = legacy.error;
    withPayments = false;
  }
  if (error) {
    if (missingSchema(error)) return null;
    throw error;
  }
  if (!data) return null;
  const ledger = splitLedgerItems(data.items);
  return {
    visible: data.visible !== false,
    items: ledger.expenses,
    waivers: ledger.waivers,
    payments: withPayments ? normalizePayments(data.payments) : null,
  };
}

export async function syncExpenseLedger(before: AppState, after: AppState) {
  if (!isSupabaseEnabled()) return;
  const beforeVisible = before.settings.showExpenses !== false;
  const afterVisible = after.settings.showExpenses !== false;
  const sameItems =
    JSON.stringify(packLedgerItems(before.expenses ?? [], before.expenseWaivers ?? [])) ===
    JSON.stringify(packLedgerItems(after.expenses ?? [], after.expenseWaivers ?? []));
  const samePayments = JSON.stringify(before.payments ?? []) === JSON.stringify(after.payments ?? []);
  if (beforeVisible === afterVisible && sameItems && samePayments) return;
  const db = getServiceSupabase();
  if (!db) return;
  const row = {
    id: 1,
    visible: afterVisible,
    items: packLedgerItems(after.expenses ?? [], after.expenseWaivers ?? []),
    payments: after.payments ?? [],
  };
  let { error } = await db.from("expense_ledger").upsert(row);
  if (error && missingPaymentsColumn(error)) {
    console.error("expense_ledger.payments column missing; payments kept locally");
    const { payments: _payments, ...legacy } = row;
    void _payments;
    ({ error } = await db.from("expense_ledger").upsert(legacy));
  }
  if (!error) return;
  if (missingSchema(error)) {
    console.error("expense ledger table missing; kept local copy");
    return;
  }
  throw error;
}

export async function loadBankAccounts(): Promise<Record<string, BankAccount> | null> {
  if (!isSupabaseEnabled()) return null;
  const db = getServiceSupabase();
  if (!db) return null;
  const { data, error } = await db.from("member_bank_accounts").select("member_id, details");
  if (error) {
    if (missingSchema(error)) return null;
    throw error;
  }
  const accounts: Record<string, BankAccount> = {};
  for (const row of data ?? []) {
    const account = normalizeBankAccount(row.details);
    if (account && typeof row.member_id === "string") accounts[row.member_id] = account;
  }
  return accounts;
}

export async function syncBankAccounts(before: AppState, after: AppState) {
  if (!isSupabaseEnabled()) return;
  const prev = before.bankAccounts ?? {};
  const next = after.bankAccounts ?? {};
  const changed = Object.keys(next).filter(
    (id) => JSON.stringify(prev[id]) !== JSON.stringify(next[id])
  );
  const removed = Object.keys(prev).filter((id) => !next[id]);
  if (!changed.length && !removed.length) return;
  const db = getServiceSupabase();
  if (!db) return;
  if (changed.length) {
    const { error } = await db.from("member_bank_accounts").upsert(
      changed.map((id) => ({ member_id: id, details: next[id], updated_at: next[id].updatedAt }))
    );
    if (error) {
      if (missingSchema(error)) {
        console.error("member_bank_accounts table missing; kept local copy");
        return;
      }
      throw error;
    }
  }
  if (removed.length) {
    const { error } = await db.from("member_bank_accounts").delete().in("member_id", removed);
    if (error && !missingSchema(error)) throw error;
  }
}
