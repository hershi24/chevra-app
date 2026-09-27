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
import { pollVoters } from "./poll";
import { signPollVote } from "./poll-link";
import type { Member, Message } from "./types";

export function pollInviteHtml(opts: {
  member: Member;
  message: Message;
  origin: string;
  authorName?: string;
}) {
  const poll = opts.message.poll!;
  const voted = new Set(poll.options.flatMap((option) => option.voterIds)).size;
  const author = opts.authorName ? escapeHtml(opts.authorName) : "";
  const options = poll.options
    .map((option) => {
      const href = `${opts.origin}/poll/${signPollVote(opts.member.id, opts.message.id, option.id)}`;
      return `<tr><td style="padding-top:8px;"><a href="${href}" style="display:block;background:#ffffff;border:1px solid ${line};border-radius:14px;padding:13px 16px;text-decoration:none;color:${ink};font-size:15px;${A}"><span style="display:inline-block;width:14px;height:14px;border:1.5px solid #c5ccd6;border-radius:50%;vertical-align:-2px;margin-left:10px;"></span>${escapeHtml(option.label)}</a></td></tr>`;
    })
    .join("");
  const intro = author
    ? `שלום ${escapeHtml(firstName(opts.member.displayName))}, ${escapeHtml(firstName(opts.authorName!))} פתח סקר בצ׳אט. לחיצה אחת על התשובה שלך — וזהו.`
    : `שלום ${escapeHtml(firstName(opts.member.displayName))}, נפתח סקר בצ׳אט. לחיצה אחת על התשובה שלך — וזהו.`;
  const inner = `
    ${kicker(author ? `סקר חדש · מ${author}` : "סקר חדש")}
    ${heading(escapeHtml(poll.question))}
    ${paragraph(intro)}
    <table role="presentation" dir="rtl" width="100%" cellpadding="0" cellspacing="0" style="margin-top:14px;">${options}</table>
    ${voted ? `<div style="margin-top:16px;font-size:12px;color:${faint};${A}">${voted === 1 ? "חבר אחד כבר הצביע" : `${voted} חברים כבר הצביעו`}</div>` : ""}
  `;
  return emailShell({
    origin: opts.origin,
    title: "סקר חדש",
    preheader: "לחיצה על תשובה מצביעה מיד. אפשר לשנות עד שהסקר נסגר.",
    inner,
  });
}

export function pollResultsHtml(opts: {
  member: Member;
  message: Message;
  members: Member[];
  origin: string;
}) {
  const poll = opts.message.poll!;
  const total = poll.options.reduce((sum, option) => sum + option.voterIds.length, 0);
  const top = Math.max(0, ...poll.options.map((option) => option.voterIds.length));
  const rows = poll.options
    .map((option) => {
      const count = option.voterIds.length;
      const pct = total ? Math.round((count / total) * 100) : 0;
      const win = top > 0 && count === top;
      const names = pollVoters(opts.members, option.voterIds);
      return `<tr><td style="padding-top:10px;">
        <table role="presentation" dir="rtl" width="100%" cellpadding="0" cellspacing="0" style="background:${win ? goldSoft : "#ffffff"};border:1px solid ${win ? "#ecdcc0" : line};border-radius:14px;${A}">
          <tr><td style="padding:12px 16px;${A}">
            <table role="presentation" dir="rtl" width="100%" cellpadding="0" cellspacing="0"><tr>
              <td style="font-size:15px;color:${ink};${A}">${escapeHtml(option.label)}${win ? ` <span style="font-size:11px;color:${gold};">· נבחר</span>` : ""}</td>
              <td style="font-size:13px;color:${muted};text-align:left;white-space:nowrap;">${count === 1 ? "קול אחד" : `${count} קולות`} · ${pct}%</td>
            </tr></table>
            <div style="margin-top:8px;height:6px;background:#eceff2;border-radius:99px;font-size:0;line-height:0;"><div style="width:${pct}%;height:6px;background:${win ? gold : "#c5ccd6"};border-radius:99px;font-size:0;line-height:0;">&nbsp;</div></div>
            <div style="margin-top:7px;font-size:12px;color:${muted};${A}">${names.length ? escapeHtml(names.join(", ")) : "אין מצביעים"}</div>
          </td></tr>
        </table>
      </td></tr>`;
    })
    .join("");
  const inner = `
    ${kicker("תוצאות הסקר")}
    ${heading(escapeHtml(poll.question))}
    ${paragraph(`שלום ${escapeHtml(firstName(opts.member.displayName))}, הסקר נסגר — הנה מה שהחבורה בחרה.`)}
    <table role="presentation" dir="rtl" width="100%" cellpadding="0" cellspacing="0" style="margin-top:8px;">${rows}</table>
  `;
  return emailShell({
    origin: opts.origin,
    title: "תוצאות הסקר",
    preheader: "הסקר נסגר. התוצאות מוצגות גם בצ׳אט.",
    inner,
  });
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
