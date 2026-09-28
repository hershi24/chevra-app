import type { AppState, BankAccount, Expense, ExpensePayment, Member } from "./types";
import { isAdmin } from "./permissions";

export function agorot(amount: number) {
  if (!Number.isFinite(amount)) return 0;
  return Math.round(amount * 100);
}

export function formatAgorot(value: number) {
  const sign = value < 0 ? "-" : "";
  const abs = Math.abs(Math.round(value));
  const shekels = Math.floor(abs / 100);
  const cents = abs % 100;
  const body = cents === 0 ? String(shekels) : `${shekels}.${String(cents).padStart(2, "0")}`;
  return `${sign}${body} ₪`;
}

export function formatShekels(amount: number) {
  return formatAgorot(agorot(amount));
}

export function parseShekels(amount: number) {
  if (!Number.isFinite(amount) || amount <= 0) throw new Error("נא למלא סכום");
  if (amount > 1_000_000) throw new Error("הסכום גדול מדי");
  return Math.round(amount * 100) / 100;
}

export function expensesOpen(state: Pick<AppState, "settings">) {
  return state.settings.showExpenses !== false;
}

export function canEditExpense(user: Member, expense: Expense) {
  return isAdmin(user) || expense.memberId === user.id || expense.createdBy === user.id;
}

export function ensureExpenses(state: AppState) {
  let changed = false;
  if (!Array.isArray(state.expenses)) {
    state.expenses = [];
    changed = true;
  }
  if (!Array.isArray(state.payments)) {
    state.payments = [];
    changed = true;
  }
  if (!state.bankAccounts || typeof state.bankAccounts !== "object") {
    state.bankAccounts = {};
    changed = true;
  }
  if (state.settings.showExpenses === undefined) {
    state.settings.showExpenses = true;
    changed = true;
  }
  return changed;
}

export function normalizeExpenses(value: unknown): Expense[] {
  if (!Array.isArray(value)) return [];
  const items: Expense[] = [];
  for (const row of value) {
    if (!row || typeof row !== "object") continue;
    const item = row as Partial<Expense>;
    if (typeof item.id !== "string" || typeof item.memberId !== "string") continue;
    const amount = Number(item.amount);
    if (!Number.isFinite(amount)) continue;
    items.push({
      id: item.id,
      memberId: item.memberId,
      createdBy: typeof item.createdBy === "string" ? item.createdBy : item.memberId,
      title: String(item.title ?? "").slice(0, 80),
      detail: String(item.detail ?? "").slice(0, 400),
      amount,
      excluded: Boolean(item.excluded),
      ...(typeof item.eventId === "string" && item.eventId ? { eventId: item.eventId } : {}),
      createdAt: typeof item.createdAt === "string" ? item.createdAt : new Date().toISOString(),
    });
  }
  return items;
}

export function normalizePayments(value: unknown): ExpensePayment[] {
  if (!Array.isArray(value)) return [];
  const items: ExpensePayment[] = [];
  for (const row of value) {
    if (!row || typeof row !== "object") continue;
    const item = row as Partial<ExpensePayment>;
    if (typeof item.id !== "string" || typeof item.fromId !== "string" || typeof item.toId !== "string") continue;
    const amount = Number(item.amount);
    if (!Number.isFinite(amount) || amount <= 0) continue;
    items.push({
      id: item.id,
      fromId: item.fromId,
      toId: item.toId,
      amount,
      ...(typeof item.eventId === "string" && item.eventId ? { eventId: item.eventId } : {}),
      note: String(item.note ?? "").slice(0, 200),
      createdBy: typeof item.createdBy === "string" ? item.createdBy : item.fromId,
      createdAt: typeof item.createdAt === "string" ? item.createdAt : new Date().toISOString(),
    });
  }
  return items;
}

const BANK_LIMITS: Record<Exclude<keyof BankAccount, "updatedAt">, number> = {
  holder: 60,
  bank: 40,
  branch: 10,
  account: 30,
  phone: 20,
  note: 200,
};

export function normalizeBankAccount(value: unknown): BankAccount | null {
  if (!value || typeof value !== "object") return null;
  const row = value as Partial<BankAccount>;
  const account = {} as BankAccount;
  for (const [key, max] of Object.entries(BANK_LIMITS) as [keyof typeof BANK_LIMITS, number][]) {
    account[key] = String(row[key] ?? "").trim().slice(0, max);
  }
  account.updatedAt = typeof row.updatedAt === "string" ? row.updatedAt : new Date().toISOString();
  return bankAccountEmpty(account) ? null : account;
}

export function parseBankAccount(value: Partial<BankAccount>): BankAccount | null {
  for (const [key, max] of Object.entries(BANK_LIMITS) as [keyof typeof BANK_LIMITS, number][]) {
    if (String(value[key] ?? "").trim().length > max) throw new Error("אחד השדות ארוך מדי");
  }
  return normalizeBankAccount({ ...value, updatedAt: new Date().toISOString() });
}

export function bankAccountEmpty(account: Omit<BankAccount, "updatedAt">) {
  return !account.bank && !account.branch && !account.account && !account.phone && !account.note;
}

export function canEditPayment(user: Member, payment: ExpensePayment) {
  return isAdmin(user) || payment.createdBy === user.id || payment.fromId === user.id;
}

/** "all" = everything, "none" = not tied to a gathering, otherwise a gathering id. */
export type ExpenseScope = string;
export const SCOPE_ALL = "all";
export const SCOPE_NONE = "none";

export function inScope(item: { eventId?: string }, scope: ExpenseScope) {
  if (scope === SCOPE_ALL) return true;
  if (scope === SCOPE_NONE) return !item.eventId;
  return item.eventId === scope;
}

export type SettlementRow = {
  memberId: string;
  spentAgorot: number;
  shareAgorot: number;
  paidAgorot: number;
  receivedAgorot: number;
  balanceAgorot: number;
  owesAgorot: number;
};

export type Settlement = {
  includedAgorot: number;
  excludedAgorot: number;
  memberCount: number;
  shareAgorot: number;
  remainderAgorot: number;
  paymentsAgorot: number;
  rows: SettlementRow[];
};

export type Transfer = { fromId: string; toId: string; amountAgorot: number };

export function settlement(
  expenses: Expense[],
  memberIds: string[],
  payments: ExpensePayment[] = []
): Settlement {
  const members = new Set(memberIds);
  const visible = expenses.filter((item) => members.has(item.memberId));
  const includedAgorot = visible
    .filter((item) => !item.excluded)
    .reduce((sum, item) => sum + agorot(item.amount), 0);
  const excludedAgorot = visible
    .filter((item) => item.excluded)
    .reduce((sum, item) => sum + agorot(item.amount), 0);
  const memberCount = memberIds.length;
  const shareAgorot = memberCount ? Math.floor(includedAgorot / memberCount) : 0;
  const remainderAgorot = memberCount ? includedAgorot % memberCount : 0;
  const order = [...memberIds].sort();
  const spent = new Map<string, number>();
  const paid = new Map<string, number>();
  const received = new Map<string, number>();
  for (const item of visible) {
    if (item.excluded) continue;
    spent.set(item.memberId, (spent.get(item.memberId) ?? 0) + agorot(item.amount));
  }
  let paymentsAgorot = 0;
  for (const item of payments) {
    if (!members.has(item.fromId) || !members.has(item.toId)) continue;
    const value = agorot(item.amount);
    paymentsAgorot += value;
    paid.set(item.fromId, (paid.get(item.fromId) ?? 0) + value);
    received.set(item.toId, (received.get(item.toId) ?? 0) + value);
  }
  const rows = memberIds.map((memberId) => {
    const share = shareAgorot + (order.indexOf(memberId) < remainderAgorot ? 1 : 0);
    const spentAgorot = spent.get(memberId) ?? 0;
    const paidAgorot = paid.get(memberId) ?? 0;
    const receivedAgorot = received.get(memberId) ?? 0;
    const balanceAgorot = spentAgorot - share + paidAgorot - receivedAgorot;
    return {
      memberId,
      spentAgorot,
      shareAgorot: share,
      paidAgorot,
      receivedAgorot,
      balanceAgorot,
      owesAgorot: balanceAgorot < 0 ? -balanceAgorot : 0,
    };
  });
  return { includedAgorot, excludedAgorot, memberCount, shareAgorot, remainderAgorot, paymentsAgorot, rows };
}

/** Greedy matching of debtors to creditors; few transfers, each closes one side. */
export function transfers(report: Settlement): Transfer[] {
  const debtors = report.rows
    .filter((row) => row.balanceAgorot < 0)
    .map((row) => ({ id: row.memberId, left: -row.balanceAgorot }))
    .sort((a, b) => b.left - a.left || a.id.localeCompare(b.id));
  const creditors = report.rows
    .filter((row) => row.balanceAgorot > 0)
    .map((row) => ({ id: row.memberId, left: row.balanceAgorot }))
    .sort((a, b) => b.left - a.left || a.id.localeCompare(b.id));
  const out: Transfer[] = [];
  let d = 0;
  let c = 0;
  while (d < debtors.length && c < creditors.length) {
    const amount = Math.min(debtors[d].left, creditors[c].left);
    if (amount > 0) out.push({ fromId: debtors[d].id, toId: creditors[c].id, amountAgorot: amount });
    debtors[d].left -= amount;
    creditors[c].left -= amount;
    if (debtors[d].left === 0) d += 1;
    if (creditors[c].left === 0) c += 1;
  }
  return out;
}

export function scopedSettlement(
  state: Pick<AppState, "expenses" | "payments" | "members">,
  scope: ExpenseScope
) {
  const expenses = (state.expenses ?? []).filter((item) => inScope(item, scope));
  const payments = (state.payments ?? []).filter((item) => inScope(item, scope));
  const report = settlement(
    expenses,
    state.members.map((member) => member.id),
    payments
  );
  return { expenses, payments, report, transfers: transfers(report) };
}

export function expenseNoticeText(
  members: Member[],
  expenses: Expense[],
  row: SettlementRow,
  options: { scopeLabel?: string; transfers?: Transfer[] } = {}
) {
  const name = (id: string) => members.find((member) => member.id === id)?.displayName ?? "חבר";
  const lines = expenses
    .filter((item) => members.some((member) => member.id === item.memberId))
    .map((item) => {
      const money = formatShekels(item.amount);
      const who = name(item.memberId);
      const detail = item.detail.trim() ? ` (${item.detail.trim()})` : "";
      if (item.excluded) return `לא נכלל: ${item.title} — ${who} — ${money}${detail}`;
      return `${item.title} — ${who} — ${money}${detail}`;
    });
  const mine = (options.transfers ?? []).filter((item) => item.fromId === row.memberId);
  const paid = row.paidAgorot ? ` כבר שילמת ${formatAgorot(row.paidAgorot)}.` : "";
  return [
    options.scopeLabel ? `באו חשבון · ${options.scopeLabel}` : "באו חשבון",
    `לתשלום: ${formatAgorot(row.owesAgorot)}`,
    `החלק שלך ${formatAgorot(row.shareAgorot)}, קנית ${formatAgorot(row.spentAgorot)}.${paid}`,
    ...(mine.length
      ? ["", "למי להעביר:", ...mine.map((item) => `${name(item.toId)} — ${formatAgorot(item.amountAgorot)}`)]
      : []),
    "",
    ...lines,
    "",
    "פרטי החשבון להעברה בדף באו חשבון.",
  ].join("\n");
}
