import { sendEmail } from "./email";
import {
  A,
  emailShell,
  escapeHtml,
  faint,
  firstName,
  gold,
  goldSoft,
  heading,
  ink,
  kicker,
  line,
  muted,
  paragraph,
} from "./email-shell";
import { expensePayers, formatAgorot, formatShekels, type SettlementRow, type Transfer } from "./expenses";
import type { BankAccount, Expense, GatheringWaiver, Member } from "./types";

export function expenseNoticeHtml(opts: {
  member: Member;
  members: Member[];
  expenses: Expense[];
  row: SettlementRow;
  transfers: Transfer[];
  bankAccounts: Record<string, BankAccount>;
  origin: string;
  scopeLabel?: string;
  waivers?: GatheringWaiver[];
}) {
  const name = (id: string) => opts.members.find((item) => item.id === id)?.displayName ?? "חבר";
  const mine = opts.transfers.filter((item) => item.fromId === opts.row.memberId);
  const paid = opts.row.paidAgorot ? ` כבר שילמת ${formatAgorot(opts.row.paidAgorot)}.` : "";

  const transferRows = mine
    .map((item) => {
      const account = opts.bankAccounts[item.toId];
      const bank = account ? bankLines(account) : "";
      return `<tr><td style="padding-top:8px;">
        <table role="presentation" dir="rtl" width="100%" cellpadding="0" cellspacing="0" style="background:#ffffff;border:1px solid ${line};border-radius:14px;${A}">
          <tr><td style="padding:12px 16px;${A}">
            <table role="presentation" dir="rtl" width="100%" cellpadding="0" cellspacing="0"><tr>
              <td style="font-size:15px;color:${ink};${A}">${escapeHtml(name(item.toId))}</td>
              <td style="font-size:15px;color:${gold};text-align:left;white-space:nowrap;">${formatAgorot(item.amountAgorot)}</td>
            </tr></table>
            ${bank}
          </td></tr>
        </table>
      </td></tr>`;
    })
    .join("");

  const memberIds = opts.members.map((member) => member.id);
  const itemRows = opts.expenses
    .filter((item) => opts.members.some((member) => member.id === item.memberId))
    .map((item) => {
      const detail = item.detail.trim() ? ` · ${escapeHtml(item.detail.trim())}` : "";
      const payers = expensePayers(item, memberIds, opts.waivers ?? []);
      const skipped = !item.excluded && payers.length > 0 && !payers.includes(opts.row.memberId);
      const style = item.excluded ? `color:${faint};text-decoration:line-through;` : `color:${ink};`;
      const note = skipped ? ` · לא בחלק שלך` : "";
      return `<tr>
        <td style="padding:7px 0;border-top:1px solid ${line};font-size:14px;${style}${A}">${escapeHtml(item.title)}<span style="color:${muted};font-size:12px;"> · ${escapeHtml(name(item.memberId))}${detail}${note}</span></td>
        <td style="padding:7px 0;border-top:1px solid ${line};font-size:14px;text-align:left;white-space:nowrap;${style}">${formatShekels(item.amount)}</td>
      </tr>`;
    })
    .join("");

  const inner = `
    ${kicker(opts.scopeLabel ? `באו חשבון · ${escapeHtml(opts.scopeLabel)}` : "באו חשבון")}
    ${heading(`לתשלום: ${formatAgorot(opts.row.owesAgorot)}`)}
    ${paragraph(`שלום ${escapeHtml(firstName(opts.member.displayName))}, החלק שלך ${formatAgorot(opts.row.shareAgorot)}, קנית ${formatAgorot(opts.row.spentAgorot)}.${paid}`)}
    ${
      transferRows
        ? `<div style="margin-top:18px;font-size:13px;color:${muted};${A}">למי להעביר</div>
    <table role="presentation" dir="rtl" width="100%" cellpadding="0" cellspacing="0">${transferRows}</table>`
        : ""
    }
    ${
      itemRows
        ? `<div style="margin-top:20px;font-size:13px;color:${muted};${A}">ההוצאות</div>
    <table role="presentation" dir="rtl" width="100%" cellpadding="0" cellspacing="0" style="margin-top:4px;">${itemRows}</table>`
        : ""
    }
    <div style="margin-top:22px;${A}">
      <a href="${opts.origin}/expenses" style="display:inline-block;background:${goldSoft};border:1px solid #ecdcc0;border-radius:999px;padding:10px 20px;text-decoration:none;color:${gold};font-size:14px;">לדף באו חשבון</a>
    </div>
  `;

  return emailShell({
    origin: opts.origin,
    title: "באו חשבון",
    preheader: "החשבון נשלח גם בהודעה פרטית בצ׳אט.",
    inner,
  });
}

function bankLines(account: BankAccount) {
  const head = [account.holder, account.bank, account.branch ? `סניף ${account.branch}` : ""]
    .filter(Boolean)
    .map(escapeHtml)
    .join(" · ");
  const numbers = [
    account.account ? `חשבון <span dir="ltr">${escapeHtml(account.account)}</span>` : "",
    account.phone ? `ביט / פייבוקס <span dir="ltr">${escapeHtml(account.phone)}</span>` : "",
  ]
    .filter(Boolean)
    .join(" · ");
  const note = account.note ? escapeHtml(account.note) : "";
  const parts = [head, numbers, note].filter(Boolean);
  if (!parts.length) return "";
  return `<div style="margin-top:6px;font-size:12px;line-height:1.7;color:${muted};${A}">${parts.join("<br />")}</div>`;
}

export async function deliverExpenseMail(
  recipients: { member: Member; html: string }[],
  subject: string
) {
  let sent = 0;
  let failed = 0;
  let skipped = 0;
  for (const { member, html } of recipients) {
    const address = member.email?.trim() ?? "";
    if (!address || address.endsWith("@chevra.local")) {
      skipped += 1;
      continue;
    }
    const result = await sendEmail({ to: address, subject, html });
    if ("ok" in result && result.ok) sent += 1;
    else failed += 1;
  }
  return { sent, failed, skipped };
}
