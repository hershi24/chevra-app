import type { Gathering, Member } from "./types";
import { formatHebrewDate, gatheringLabel, rsvpLabel } from "./format";
import {
  A,
  emailShell,
  escapeHtml,
  faint,
  firstName,
  gold,
  goldSoft,
  green,
  heading,
  ink,
  kicker,
  line,
  muted,
  paragraph,
} from "./email-shell";

const TZ = "Asia/Jerusalem";

function jerusalemParts(iso: string) {
  const date = new Date(iso);
  const pick = (options: Intl.DateTimeFormatOptions) =>
    new Intl.DateTimeFormat("he-IL", { timeZone: TZ, ...options }).format(date);
  return {
    day: pick({ day: "numeric" }),
    month: pick({ month: "long" }),
    weekday: pick({ weekday: "long" }),
    time: pick({ hour: "2-digit", minute: "2-digit", hour12: false }),
    dayKey: new Intl.DateTimeFormat("en-CA", { timeZone: TZ }).format(date),
  };
}

function whenPhrase(iso: string) {
  const event = jerusalemParts(iso);
  const today = jerusalemParts(new Date().toISOString());
  const days = Math.round(
    (Date.parse(event.dayKey) - Date.parse(today.dayKey)) / 86_400_000
  );
  if (days === 0) return "היום";
  if (days === 1) return "מחר";
  if (days > 1 && days < 7) return `ב${event.weekday}`;
  return `ב־${event.day} ב${event.month}`;
}

export function invitationHtml(opts: {
  member: Member;
  event: Gathering;
  hostName: string;
  kibudName?: string;
  lecturerName?: string;
  senderName?: string;
  yesUrl: string;
  maybeUrl: string;
  noUrl: string;
  note?: string;
  origin: string;
  variant?: "invite" | "nudge";
}) {
  const { member, event, hostName, kibudName, lecturerName, senderName, yesUrl, maybeUrl, noUrl, note, origin } = opts;
  const nudge = opts.variant === "nudge";
  const when = jerusalemParts(event.startsAt);
  const title = gatheringLabel(event);
  const personal = note?.trim() ? escapeHtml(note.trim()).replaceAll("\n", "<br>") : "";
  const confirmed = Object.values(event.rsvps).filter((status) => status === "yes").length;
  const topic = event.topic?.trim();
  const lesson = lecturerName
    ? topic && topic !== title
      ? `${escapeHtml(topic)} · ${escapeHtml(lecturerName)}`
      : escapeHtml(lecturerName)
    : "";
  const details: [string, string][] = [
    ["מקום", event.location ? escapeHtml(event.location) : ""],
    ["מארח", hostName ? escapeHtml(hostName) : ""],
    ["כיבוד", kibudName ? escapeHtml(kibudName) : ""],
    ["שיעור", lesson],
  ];
  const detailRows = details
    .filter(([, value]) => value)
    .map(
      ([label, value]) =>
        `<tr><td style="padding:9px 0 0;width:70px;color:${muted};font-size:12px;vertical-align:top;${A}">${label}</td><td style="padding:9px 0 0;color:${ink};${A}">${value}</td></tr>`
    )
    .join("");

  const opening = nudge
    ? `
    ${kicker("תזכורת קטנה")}
    ${heading(`${escapeHtml(firstName(member.displayName))}, מחכים רק להחלטה שלך`)}
    ${paragraph(
      confirmed
        ? `${confirmed === 1 ? "חבר אחד כבר אישר" : `${confirmed} חברים כבר אישרו`} שהם מגיעים ${whenPhrase(event.startsAt)}. נשאר רק לדעת מה איתך. לחיצה אחת ומסיימים.`
        : `החברה ${whenPhrase(event.startsAt)} כבר בפתח, ונשאר רק לדעת מה איתך. לחיצה אחת ומסיימים.`
    )}`
    : `
    ${kicker("הזמנה לחברה")}
    ${heading(`${escapeHtml(firstName(member.displayName))}, מחכים לך ${whenPhrase(event.startsAt)}`)}
    ${paragraph("החברה הבאה כבר בפתח. נשמח לראות אותך — ספר לנו אם אתה מגיע.")}`;

  const inner = `
    ${opening}

    <table role="presentation" dir="rtl" width="100%" cellpadding="0" cellspacing="0" style="margin-top:22px;background:#ffffff;border:1px solid ${line};border-radius:18px;${A}">
      <tr><td style="padding:18px 20px;${A}">
        <table role="presentation" dir="rtl" cellpadding="0" cellspacing="0" style="${A}"><tr>
          <td valign="middle" style="width:64px;">
            <div style="width:64px;border-radius:16px;background:${goldSoft};color:${gold};text-align:center;padding:9px 0 8px;">
              <div style="font-size:26px;line-height:1;">${when.day}</div>
              <div style="font-size:11px;margin-top:4px;">${when.month}</div>
            </div>
          </td>
          <td valign="middle" style="padding-right:14px;${A}">
            <div style="font-size:18px;line-height:1.3;color:${ink};">${escapeHtml(title)}</div>
            <div style="font-size:13px;color:${muted};margin-top:3px;">${when.weekday} · ${when.time} · ${formatHebrewDate(event.startsAt)}</div>
          </td>
        </tr></table>
        ${
          detailRows
            ? `<table role="presentation" dir="rtl" width="100%" cellpadding="0" cellspacing="0" style="margin-top:16px;border-top:1px solid #eef0f3;font-size:14px;line-height:1.6;${A}">${detailRows}</table>`
            : ""
        }
      </td></tr>
    </table>

    ${
      personal
        ? `<table role="presentation" dir="rtl" width="100%" cellpadding="0" cellspacing="0" style="margin-top:18px;${A}">
      <tr><td style="border-right:3px solid ${gold};background:${goldSoft};border-radius:12px;padding:12px 16px;font-size:14px;line-height:1.7;color:#4b4033;${A}">
        <div style="font-size:11px;color:${gold};margin-bottom:2px;">${senderName ? `מילה מ${escapeHtml(firstName(senderName))}` : "מילה מהמארגנים"}</div>
        ${personal}
      </td></tr>
    </table>`
        : ""
    }

    <div style="margin-top:26px;font-size:13px;color:${muted};${A}">אתה מגיע?</div>
    <table role="presentation" dir="rtl" width="100%" cellpadding="0" cellspacing="0" style="margin-top:10px;">
      <tr>
        <td width="40%" style="padding-left:6px;"><a href="${yesUrl}" style="display:block;text-align:center;background:${green};color:#ffffff;text-decoration:none;padding:13px 0;border-radius:999px;font-size:15px;">✓ מגיע</a></td>
        <td width="30%" style="padding-left:6px;"><a href="${maybeUrl}" style="display:block;text-align:center;background:#ffffff;color:#3f4650;text-decoration:none;padding:12px 0;border-radius:999px;font-size:15px;border:1px solid #dfe3e8;">אולי</a></td>
        <td width="30%"><a href="${noUrl}" style="display:block;text-align:center;background:#ffffff;color:#3f4650;text-decoration:none;padding:12px 0;border-radius:999px;font-size:15px;border:1px solid #dfe3e8;">לא אוכל</a></td>
      </tr>
    </table>
    <div style="margin-top:14px;font-size:12px;color:${faint};${A}">התשובה הנוכחית שלך: ${rsvpLabel(event.rsvps[member.id] ?? "pending")}${confirmed ? ` · ${confirmed} כבר אישרו הגעה` : ""}</div>
  `;

  return emailShell({
    origin,
    title: nudge ? "מחכים רק להחלטה שלך" : "הזמנה לחברה",
    preheader: nudge
      ? "עוד לא ענית אם אתה מגיע. כפתור אחד, בלי להתחבר לאתר."
      : "לחיצה על כפתור מעדכנת את ההגעה — בלי להתחבר לאתר.",
    inner,
  });
}

export function nudgeSubject(member: Member) {
  return `${firstName(member.displayName)}, מחכים רק להחלטה שלך`;
}

function resendReason(status: number, text: string) {
  let message = "";
  try {
    const data = JSON.parse(text) as { message?: string; error?: string; name?: string };
    message = data.message || data.error || data.name || "";
  } catch {
    message = text;
  }
  message = message.replace(/\s+/g, " ").trim();
  if (/testing emails|verify a domain|domain is not verified/i.test(message)) {
    return "הדומיין של השולח לא מאומת ב־Resend, אפשר לשלוח רק לכתובת של בעל החשבון";
  }
  if (/invalid.*(to|email)|not a valid email/i.test(message)) return "כתובת המייל לא תקינה";
  if (/api key is invalid|invalid api key|unauthorized/i.test(message) || status === 401) {
    return "מפתח Resend לא תקין";
  }
  if (status === 429 || /rate limit|too many/i.test(message)) return "יותר מדי שליחות ברגע אחד, נסו שוב בעוד דקה";
  return message ? `Resend: ${message.slice(0, 160)}` : `Resend החזיר שגיאה ${status}`;
}

export async function sendEmail(opts: {
  to: string;
  subject: string;
  html: string;
}) {
  const key = process.env.RESEND_API_KEY2 || process.env.RESEND_API_KEY;
  const from = process.env.RESEND_FROM || "מיין חברה <chevra@localhost>";
  if (!key) {
    return { id: `mock-${Date.now()}`, mock: true as const, ok: false as const };
  }
  let res: Response;
  try {
    res = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${key}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ from, to: opts.to, subject: opts.subject, html: opts.html }),
    });
  } catch {
    return { ok: false as const, error: "השרת לא הצליח להתחבר ל־Resend" };
  }
  if (!res.ok) {
    const text = await res.text();
    return { ok: false as const, error: resendReason(res.status, text) };
  }
  const data = (await res.json()) as { id?: string };
  return { ok: true as const, id: data.id };
}
