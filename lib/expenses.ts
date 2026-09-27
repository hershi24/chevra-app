import type { AppState, Expense, Member } from "./types";
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
      createdAt: typeof item.createdAt === "string" ? item.createdAt : new Date().toISOString(),
    });
  }
  return items;
}

export type SettlementRow = {
  memberId: string;
  spentAgorot: number;
  shareAgorot: number;
  balanceAgorot: number;
  owesAgorot: number;
};

export type Settlement = {
  includedAgorot: number;
  excludedAgorot: number;
  memberCount: number;
  shareAgorot: number;
  remainderAgorot: number;
  rows: SettlementRow[];
};

export function settlement(expenses: Expense[], memberIds: string[]): Settlement {
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
  for (const id of memberIds) spent.set(id, 0);
  for (const item of visible) {
    if (item.excluded) continue;
    spent.set(item.memberId, (spent.get(item.memberId) ?? 0) + agorot(item.amount));
  }
  const rows = memberIds.map((memberId) => {
    const share = shareAgorot + (order.indexOf(memberId) < remainderAgorot ? 1 : 0);
    const spentAgorot = spent.get(memberId) ?? 0;
    const balanceAgorot = spentAgorot - share;
    return {
      memberId,
      spentAgorot,
      shareAgorot: share,
      balanceAgorot,
      owesAgorot: balanceAgorot < 0 ? -balanceAgorot : 0,
    };
  });
  return { includedAgorot, excludedAgorot, memberCount, shareAgorot, remainderAgorot, rows };
}

export function expenseNoticeText(members: Member[], expenses: Expense[], row: SettlementRow) {
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
  return [
    "באו חשבון",
    `לתשלום: ${formatAgorot(row.owesAgorot)}`,
    `החלק שלך ${formatAgorot(row.shareAgorot)}, קנית ${formatAgorot(row.spentAgorot)}.`,
    "",
    ...lines,
  ].join("\n");
}
