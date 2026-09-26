import { sendEmail } from "./email";
import { pollVoters } from "./poll";
import { signPollVote } from "./poll-link";
import type { Member, Message } from "./types";

function escapeHtml(value: string) {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;");
}

function shell(title: string, body: string) {
  const align = "direction:rtl;text-align:right;";
  return `<!doctype html>
<html lang="he" dir="rtl">
  <body dir="rtl" style="margin:0;background:#f4eee4;font-family:Arial,Helvetica,sans-serif;color:#2c2118;${align}">
    <table role="presentation" dir="rtl" width="100%" cellpadding="0" cellspacing="0" style="background:#f4eee4;padding:24px 0;${align}">
      <tr><td align="center">
        <table role="presentation" dir="rtl" width="560" cellpadding="0" cellspacing="0" style="background:#fffaf4;border-radius:18px;overflow:hidden;border:1px solid #ead9c4;${align}">
          <tr><td dir="rtl" align="right" style="background:#3f4650;color:#fff;padding:24px 28px;${align}">
            <div style="font-size:13px;">מיין חברה</div>
            <h1 style="margin:8px 0 0;font-size:24px;${align}">${title}</h1>
          </td></tr>
          <tr><td dir="rtl" align="right" style="padding:24px 28px;${align}">${body}</td></tr>
        </table>
      </td></tr>
    </table>
  </body>
</html>`;
}

export function pollInviteHtml(opts: {
  member: Member;
  message: Message;
  origin: string;
}) {
  const poll = opts.message.poll!;
  const buttons = poll.options
    .map((option) => {
      const href = `${opts.origin}/poll/${signPollVote(opts.member.id, opts.message.id, option.id)}`;
      return `<div style="margin-top:8px;"><a href="${href}" style="display:block;background:#fff;color:#1f2328;text-decoration:none;padding:12px 14px;border-radius:12px;font-weight:600;border:1px solid #e5e7eb;">${escapeHtml(option.label)}</a></div>`;
    })
    .join("");
  return shell(
    "סקר חדש",
    `<p style="margin:0 0 12px;">שלום ${escapeHtml(opts.member.displayName)},</p>
     <p style="margin:0 0 16px;font-size:18px;font-weight:600;">${escapeHtml(poll.question)}</p>
     ${buttons}`
  );
}

export function pollResultsHtml(opts: { member: Member; message: Message; members: Member[] }) {
  const poll = opts.message.poll!;
  const rows = poll.options
    .map((option) => {
      const names = pollVoters(opts.members, option.voterIds);
      return `<div style="margin-top:10px;padding:10px 12px;background:#f3f4f6;border-radius:12px;">
        <div><strong>${escapeHtml(option.label)}</strong> · ${option.voterIds.length}</div>
        <div style="color:#6b7280;font-size:13px;margin-top:4px;">${names.length ? escapeHtml(names.join(", ")) : "אין מצביעים"}</div>
      </div>`;
    })
    .join("");
  return shell(
    "תוצאות הסקר",
    `<p style="margin:0 0 12px;">שלום ${escapeHtml(opts.member.displayName)},</p>
     <p style="margin:0 0 8px;font-size:18px;font-weight:600;">${escapeHtml(poll.question)}</p>
     ${rows}`
  );
}

export async function deliverPollMail(opts: {
  members: Member[];
  message: Message;
  subject: string;
  htmlFor: (member: Member) => string;
}) {
  let sent = 0;
  let failed = 0;
  let skipped = 0;
  for (const member of opts.members) {
    const address = member.email?.trim() ?? "";
    if (!address || address.endsWith("@chevra.local")) {
      skipped += 1;
      continue;
    }
    const result = await sendEmail({ to: address, subject: opts.subject, html: opts.htmlFor(member) });
    if ("ok" in result && result.ok) sent += 1;
    else failed += 1;
  }
  return { sent, failed, skipped };
}
