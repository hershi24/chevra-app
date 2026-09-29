import { chatEmailPrefsFor, chatEmailRecipients, hasRealEmail, wantsChatEmail } from "./chat-email-prefs";
import { canSeeChannel } from "./channels";
import { channelReadAt } from "./chat-reads";
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
import { readState } from "./store";
import type { AppState, Channel, Member, Message } from "./types";

/** A chat that was quiet this long counts as a new conversation: its first message is mailed at once. */
const QUIET_MS = 30 * 60 * 1000;
/** While a conversation runs, the rest is gathered into one summary this long after the opening mail... */
const FIRST_DIGEST_MS = 5 * 60 * 1000;
/** ...and after that at most one summary per this interval. */
const DIGEST_EVERY_MS = 30 * 60 * 1000;
const DIGEST_PREVIEW = 5;

type Thread = { lastSentAt: number; digests: number; timer?: ReturnType<typeof setTimeout> };

const g = globalThis as unknown as { __chevraMailThreads?: Map<string, Thread> };
const threads = (g.__chevraMailThreads ??= new Map());

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

function subjectFor(channel: Channel, authorName: string) {
  return channel.type === "dm" ? `הודעה פרטית מ${authorName}` : `${authorName} ב${channel.name}`;
}

async function deliver(member: Member, subject: string, html: string) {
  const result = await sendEmail({ to: member.email.trim(), subject, html });
  if (!("ok" in result && result.ok) && !("mock" in result && result.mock)) {
    console.error("chat email failed", member.id, "error" in result ? result.error : "");
  }
}

function listNames(names: string[]) {
  if (names.length <= 1) return names[0] ?? "";
  if (names.length === 2) return `${names[0]} ו${names[1]}`;
  if (names.length === 3) return `${names[0]}, ${names[1]} ו${names[2]}`;
  return `${names[0]}, ${names[1]} ועוד ${names.length - 2}`;
}

function clock(iso: string) {
  return new Intl.DateTimeFormat("he-IL", {
    timeZone: "Asia/Jerusalem",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  }).format(new Date(iso));
}

export function chatDigestHtml(opts: {
  member: Member;
  channel: Channel;
  messages: Message[];
  members: Member[];
  origin: string;
}) {
  const { member, channel, messages, members, origin } = opts;
  const nameOf = (id: string) => members.find((item) => item.id === id)?.displayName ?? "חבר";
  const count = messages.length;
  const recent = messages.slice(-DIGEST_PREVIEW);
  const writers = [...new Set(messages.map((message) => message.authorId))].map((id) => firstName(nameOf(id)));
  const dm = channel.type === "dm";
  const countText = count === 1 ? "הודעה חדשה אחת" : `${count} הודעות חדשות`;
  const join = `${origin}/login?next=${encodeURIComponent(`/chat/${encodeURIComponent(channel.id)}`)}`;

  const rows = recent
    .map(
      (message, index) => `
      <tr><td style="padding:10px 0;${index ? `border-top:1px solid ${line};` : ""}${A}">
        <div style="font-size:12.5px;color:${muted};${A}"><span style="color:${ink};">${escapeHtml(nameOf(message.authorId))}</span> · ${clock(message.createdAt)}</div>
        <div style="margin-top:2px;font-size:14.5px;line-height:1.7;color:${ink};white-space:pre-wrap;${A}">${escapeHtml(messageBody(message).slice(0, 220)).replaceAll("\n", "<br />")}</div>
      </td></tr>`
    )
    .join("");
  const earlier = count > recent.length
    ? `<div style="margin-bottom:6px;font-size:12px;color:${faint};${A}">ועוד ${count - recent.length} הודעות קודמות בשיחה…</div>`
    : "";

  const inner = `
    ${kicker(dm ? "הודעות פרטיות" : `בצ׳אט ${escapeHtml(channel.name)}`)}
    ${heading(dm ? `${escapeHtml(firstName(nameOf(messages[0].authorId)))} ממשיך לכתוב לך` : `השיחה ב${escapeHtml(channel.name)} בעיצומה`)}
    ${paragraph(
      dm
        ? `שלום ${escapeHtml(firstName(member.displayName))}, מאז המייל הקודם נכתבו לך ${countText}.`
        : `שלום ${escapeHtml(firstName(member.displayName))}, מאז המייל הקודם נכתבו ${countText} מ${escapeHtml(listNames(writers))}. הנה הצצה למה שקורה – בואו להצטרף!`
    )}
    <table role="presentation" dir="rtl" width="100%" cellpadding="0" cellspacing="0" style="margin-top:16px;">
      <tr><td style="background:#ffffff;border:1px solid ${line};border-radius:16px;padding:8px 16px;${A}">
        ${earlier}
        <table role="presentation" dir="rtl" width="100%" cellpadding="0" cellspacing="0">${rows}</table>
      </td></tr>
    </table>
    <table role="presentation" dir="rtl" cellpadding="0" cellspacing="0" style="margin-top:20px;">
      <tr>
        <td style="border-radius:999px;background:${gold};">
          <a href="${join}" style="display:inline-block;padding:12px 26px;font-size:15px;color:#ffffff;text-decoration:none;">${dm ? "לשיחה" : "הצטרפו לשיחה"}</a>
        </td>
      </tr>
    </table>
    <div style="margin-top:18px;font-size:12px;color:${faint};${A}">
      כדי שהתיבה לא תתמלא, בשיחה ערה נשלח מייל אחד כשהיא מתחילה ואחר כך סיכום מדי פעם.
      אפשר לשנות אילו הודעות מגיעות במייל ב<a href="${origin}/login?next=${encodeURIComponent("/settings#settings-notify")}" style="color:${gold};text-decoration:none;background:${goldSoft};padding:1px 6px;border-radius:6px;">הגדרות</a>.
    </div>
  `;

  return emailShell({
    origin,
    title: dm ? "הודעות פרטיות חדשות" : `שיחה ערה ב${channel.name}`,
    preheader: `${countText}${dm ? "" : ` ב${channel.name}`}`,
    inner,
  });
}

async function sendDigest(key: string, memberId: string, channelId: string, origin: string) {
  const thread = threads.get(key);
  if (!thread) return;
  thread.timer = undefined;
  try {
    const state = await readState();
    const member = state.members.find((item) => item.id === memberId);
    const channel = state.channels.find((item) => item.id === channelId);
    if (!member || !channel || !hasRealEmail(member) || !canSeeChannel(member, channel)) return;
    if (!wantsChatEmail(chatEmailPrefsFor(state, member.id), channel)) return;
    const readAt = await channelReadAt(member.id, channel.id).catch(() => null);
    const since = Math.max(thread.lastSentAt, readAt ? Date.parse(readAt) : 0);
    const fresh = state.messages
      .filter(
        (message) =>
          message.channelId === channel.id &&
          message.authorId !== member.id &&
          Date.parse(message.createdAt) > since
      )
      .sort((a, b) => Date.parse(a.createdAt) - Date.parse(b.createdAt));
    if (!fresh.length) return;
    thread.lastSentAt = Date.now();
    thread.digests += 1;
    const subject =
      channel.type === "dm"
        ? `${fresh.length} הודעות פרטיות חדשות`
        : `השיחה ב${channel.name} בעיצומה · ${fresh.length} הודעות חדשות`;
    await deliver(member, subject, chatDigestHtml({ member, channel, messages: fresh, members: state.members, origin }));
  } catch (error) {
    console.error("chat digest failed", error);
  }
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
    const subject = subjectFor(channel, author?.displayName ?? "חבר");
    const now = Date.now();
    for (const member of recipients) {
      const key = `${member.id}:${channel.id}`;
      const thread = threads.get(key);
      if (!thread || (!thread.timer && now - thread.lastSentAt > QUIET_MS)) {
        threads.set(key, { lastSentAt: now, digests: 0 });
        await deliver(member, subject, chatMessageHtml({ member, author, channel, message, quotedAuthor, origin }));
        continue;
      }
      if (thread.timer) continue;
      const due = thread.lastSentAt + (thread.digests ? DIGEST_EVERY_MS : FIRST_DIGEST_MS);
      thread.timer = setTimeout(() => void sendDigest(key, member.id, channel.id, origin), Math.max(due - now, 1000));
    }
  } catch (error) {
    console.error("chat email notify failed", error);
  }
}
