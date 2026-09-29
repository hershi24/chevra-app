import { chatEmailRecipients } from "./chat-email-prefs";
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
import type { AppState, Channel, Member, Message } from "./types";

function messageBody(message: Message) {
  if (message.poll) return `סקר: ${message.poll.question}`;
  const text = message.text.trim();
  if (text) return text;
  if (message.voiceUrl) return "הודעה קולית";
  const kinds = message.attachments.map((file) => file.type);
  if (kinds.length > 1) return `${kinds.length} קבצים מצורפים`;
  if (kinds[0] === "image") return "תמונה";
  if (kinds[0] === "video") return "סרטון";
  if (kinds[0] === "audio") return "הקלטה";
  return kinds.length ? "קובץ מצורף" : "הודעה חדשה";
}

function absolute(url: string, origin: string) {
  return /^https?:\/\//.test(url) ? url : `${origin}${url.startsWith("/") ? "" : "/"}${url}`;
}

export function replyPath(message: Message) {
  return `/chat/${encodeURIComponent(message.channelId)}?reply=${encodeURIComponent(message.id)}`;
}

export function chatMessageHtml(opts: {
  member: Member;
  author?: Member;
  channel: Channel;
  message: Message;
  quotedAuthor?: Member;
  origin: string;
}) {
  const { member, author, channel, message, origin } = opts;
  const authorName = author?.displayName ?? "חבר";
  const where = channel.type === "dm" ? "הודעה פרטית" : `בצ׳אט ${escapeHtml(channel.name)}`;
  const reply = `${origin}/login?next=${encodeURIComponent(replyPath(message))}`;
  const image = message.attachments.find((file) => file.type === "image");
  const extraFiles = message.text.trim() && message.attachments.length
    ? `<div style="margin-top:8px;font-size:12px;color:${muted};${A}">${
        message.attachments.length === 1 ? "מצורף קובץ" : `מצורפים ${message.attachments.length} קבצים`
      }</div>`
    : "";
  const quote = message.quote
    ? `<div style="margin-bottom:10px;border-inline-start:3px solid ${gold};padding:2px 10px;font-size:12.5px;color:${muted};${A}">${
        opts.quotedAuthor ? `${escapeHtml(opts.quotedAuthor.displayName)}: ` : ""
      }${escapeHtml(message.quote.text.slice(0, 160))}</div>`
    : "";

  const inner = `
    ${kicker(where)}
    ${heading(channel.type === "dm" ? `${escapeHtml(authorName)} כתב לך` : `הודעה חדשה מ${escapeHtml(authorName)}`)}
    ${paragraph(`שלום ${escapeHtml(firstName(member.displayName))}, ${channel.type === "dm" ? "קיבלת הודעה פרטית בצ׳אט" : `נכתבה הודעה חדשה ב${escapeHtml(channel.name)}`}.`)}
    <table role="presentation" dir="rtl" width="100%" cellpadding="0" cellspacing="0" style="margin-top:16px;">
      <tr><td style="background:#ffffff;border:1px solid ${line};border-radius:16px;padding:14px 16px;${A}">
        ${quote}
        <div style="font-size:15px;line-height:1.75;color:${ink};white-space:pre-wrap;${A}">${escapeHtml(messageBody(message)).replaceAll("\n", "<br />")}</div>
        ${image ? `<img src="${escapeHtml(absolute(image.url, origin))}" alt="" width="240" style="display:block;margin-top:10px;max-width:100%;width:240px;height:auto;border-radius:12px;border:0;" />` : ""}
        ${extraFiles}
      </td></tr>
    </table>
    <table role="presentation" dir="rtl" cellpadding="0" cellspacing="0" style="margin-top:20px;">
      <tr>
        <td style="border-radius:999px;background:${gold};">
          <a href="${reply}" style="display:inline-block;padding:12px 26px;font-size:15px;color:#ffffff;text-decoration:none;">השבה</a>
        </td>
      </tr>
    </table>
    <div style="margin-top:18px;font-size:12px;color:${faint};${A}">
      אפשר לשנות אילו הודעות מגיעות במייל ב<a href="${origin}/login?next=${encodeURIComponent("/settings#settings-notify")}" style="color:${gold};text-decoration:none;background:${goldSoft};padding:1px 6px;border-radius:6px;">הגדרות</a>.
    </div>
  `;

  return emailShell({
    origin,
    title: "הודעה חדשה בצ׳אט",
    preheader: messageBody(message).slice(0, 90),
    inner,
  });
}

export async function notifyChatEmail(state: AppState, message: Message, origin: string) {
  try {
    const channel = state.channels.find((item) => item.id === message.channelId);
    if (!channel) return;
    const recipients = chatEmailRecipients(state, channel, message.authorId);
    if (!recipients.length) return;
    const author = state.members.find((item) => item.id === message.authorId);
    const quotedAuthor = message.quote
      ? state.members.find((item) => item.id === message.quote!.authorId)
      : undefined;
    const name = author?.displayName ?? "חבר";
    const subject = channel.type === "dm" ? `הודעה פרטית מ${name}` : `${name} ב${channel.name}`;
    for (const member of recipients) {
      const result = await sendEmail({
        to: member.email.trim(),
        subject,
        html: chatMessageHtml({ member, author, channel, message, quotedAuthor, origin }),
      });
      if (!("ok" in result && result.ok) && !("mock" in result && result.mock)) {
        console.error("chat email failed", member.id, "error" in result ? result.error : "");
      }
    }
  } catch (error) {
    console.error("chat email notify failed", error);
  }
}
