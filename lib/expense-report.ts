import {
  SCOPE_ALL,
  SCOPE_NONE,
  agorot,
  expenseScopeLabel,
  paymentMethodLabel,
  scopedSettlement,
} from "./expenses";
import { formatDateShortHe, gatheringLabel } from "./format";
import type { AppState } from "./types";

export type ExpenseReport = ReturnType<typeof buildExpenseReport>;

export function reportScope(state: Pick<AppState, "gatherings">, value?: string | null) {
  if (!value || value === SCOPE_ALL) return SCOPE_ALL;
  if (value === SCOPE_NONE) return SCOPE_NONE;
  return state.gatherings.some((event) => event.id === value) ? value : SCOPE_ALL;
}

/** Plain rows with amounts in shekels, shared by the Excel export and the print page. */
export function buildExpenseReport(state: AppState, scope: string) {
  const name = (id: string) => state.members.find((member) => member.id === id)?.displayName ?? "חבר";
  const eventName = (id?: string) => {
    if (!id) return "";
    const event = state.gatherings.find((item) => item.id === id);
    return event ? `${gatheringLabel(event)} · ${formatDateShortHe(event.startsAt)}` : "";
  };
  const shekels = (value: number) => value / 100;
  const { expenses, payments, report, transfers } = scopedSettlement(state, scope);

  return {
    groupName: state.settings.groupName || "מיין חברה",
    scopeLabel: expenseScopeLabel(state, scope),
    showEvent: scope === SCOPE_ALL,
    totals: {
      included: shekels(report.includedAgorot),
      excluded: shekels(report.excludedAgorot),
      share: shekels(report.shareAgorot),
      paid: shekels(report.paymentsAgorot),
      memberCount: report.memberCount,
      remainderAgorot: report.remainderAgorot,
    },
    members: report.rows.map((row) => ({
      name: name(row.memberId),
      spent: shekels(row.spentAgorot),
      share: shekels(row.shareAgorot),
      paid: shekels(row.paidAgorot),
      received: shekels(row.receivedAgorot),
      balance: shekels(row.balanceAgorot),
      status: row.balanceAgorot > 0 ? "מגיע לו" : row.balanceAgorot < 0 ? "לשלם" : "מאוזן",
    })),
    expenses: [...expenses]
      .sort((a, b) => a.createdAt.localeCompare(b.createdAt))
      .map((item) => ({
        date: formatDateShortHe(item.createdAt),
        title: item.title,
        buyer: name(item.memberId),
        detail: item.detail,
        event: eventName(item.eventId),
        amount: shekels(agorot(item.amount)),
        excluded: item.excluded,
      })),
    payments: [...payments]
      .sort((a, b) => a.createdAt.localeCompare(b.createdAt))
      .map((item) => ({
        date: formatDateShortHe(item.createdAt),
        from: name(item.fromId),
        to: name(item.toId),
        method: paymentMethodLabel(item.method),
        event: eventName(item.eventId),
        note: item.note,
        amount: shekels(agorot(item.amount)),
      })),
    transfers: transfers.map((item) => ({
      from: name(item.fromId),
      to: name(item.toId),
      amount: shekels(item.amountAgorot),
    })),
  };
}

export function reportFileName(report: ExpenseReport, ext: string) {
  const safe = report.scopeLabel.replace(/[\\/:*?"<>|]+/g, " ").replace(/\s+/g, " ").trim();
  return `באו חשבון - ${safe}.${ext}`;
}
