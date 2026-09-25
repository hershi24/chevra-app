import type { Gathering, Member } from "./types";
import { formatDateTimeHe, formatHebrewDate, gatheringLabel, rsvpLabel } from "./format";

export function invitationHtml(opts: {
  member: Member;
  event: Gathering;
  hostName: string;
  kibudName?: string;
  lecturerName?: string;
  yesUrl: string;
  maybeUrl: string;
  noUrl: string;
  note?: string;
}) {
  const { member, event, hostName, kibudName, lecturerName, yesUrl, maybeUrl, noUrl, note } = opts;
  const personal = note?.trim() ? escapeHtml(note.trim()).replaceAll("\n", "<br>") : "";
  const align = "direction:rtl;text-align:right;";
  return `<!doctype html>
<html lang="he" dir="rtl">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width" />
    <title>הזמנה לחברה</title>
  </head>
  <body dir="rtl" style="margin:0;background:#f4eee4;font-family:Arial,Helvetica,sans-serif;color:#2c2118;${align}">
    <table role="presentation" dir="rtl" width="100%" cellpadding="0" cellspacing="0" style="background:#f4eee4;padding:24px 0;${align}">
      <tr>
        <td align="center" dir="rtl">
          <table role="presentation" dir="rtl" width="560" cellpadding="0" cellspacing="0" style="background:#fffaf4;border-radius:18px;overflow:hidden;border:1px solid #ead9c4;${align}">
            <tr>
              <td dir="rtl" align="right" style="background:#0f5f59;color:#f8f1e6;padding:28px 32px;${align}">
                <div style="font-size:13px;letter-spacing:0.08em;${align}">מיין חברה</div>
                <h1 style="margin:8px 0 0;font-size:26px;font-weight:700;${align}">הזמנה לחברה</h1>
              </td>
            </tr>
            <tr>
              <td dir="rtl" align="right" style="padding:28px 32px 8px;${align}">
                <p style="margin:0 0 16px;font-size:16px;${align}">שלום ${member.displayName},</p>
                <p style="margin:0 0 18px;line-height:1.7;${align}">
                  מחכים לך ב<strong>${escapeHtml(gatheringLabel(event))}</strong>.
                  לחיצה אחת על הכפתור מעדכנת את ההגעה — בלי צורך להתחבר.
                </p>
                ${personal ? `<p style="margin:0 0 18px;line-height:1.7;${align}">${personal}</p>` : ""}
                <table role="presentation" dir="rtl" width="100%" cellpadding="0" cellspacing="0" style="background:#f7f1e8;border-radius:14px;margin-bottom:22px;${align}">
                  <tr>
                    <td dir="rtl" align="right" style="padding:18px 20px;font-size:15px;line-height:1.8;${align}">
                      <div style="${align}"><strong>מתי:</strong> ${formatHebrewDate(event.startsAt)}</div>
                      <div style="${align}">${formatDateTimeHe(event.startsAt)}</div>
                      ${event.location ? `<div style="${align}"><strong>איפה:</strong> ${event.location}</div>` : ""}
                      <div style="${align}"><strong>מארח:</strong> ${hostName}</div>
                      ${lecturerName ? `<div style="${align}"><strong>שיעור:</strong> ${event.topic ?? ""} · ${lecturerName}</div>` : ""}
                      ${kibudName ? `<div style="${align}"><strong>כיבוד:</strong> ${kibudName}</div>` : ""}
                    </td>
                  </tr>
                </table>
                <table role="presentation" dir="rtl" align="right" cellpadding="0" cellspacing="0" style="${align}">
                  <tr>
                    <td dir="rtl" align="right" style="padding-left:10px;">
                      <a href="${yesUrl}" style="display:inline-block;background:#0f5f59;color:#fff;text-decoration:none;padding:12px 18px;border-radius:999px;font-weight:700;">מאשר הגעה</a>
                    </td>
                    <td dir="rtl" align="right" style="padding-left:10px;">
                      <a href="${maybeUrl}" style="display:inline-block;background:#fff;color:#2c2118;text-decoration:none;padding:12px 18px;border-radius:999px;font-weight:700;border:1px solid #ead9c4;">אולי</a>
                    </td>
                    <td dir="rtl" align="right">
                      <a href="${noUrl}" style="display:inline-block;background:#fff;color:#8a3b2b;text-decoration:none;padding:12px 18px;border-radius:999px;font-weight:700;border:1px solid #e4c7be;">לא אוכל להגיע</a>
                    </td>
                  </tr>
                </table>
              </td>
            </tr>
            <tr>
              <td dir="rtl" align="right" style="padding:0 32px 24px;font-size:12px;color:#9a8876;${align}">הסטטוס הנוכחי שלך: ${rsvpLabel(event.rsvps[member.id] ?? "pending")}</td>
            </tr>
          </table>
        </td>
      </tr>
    </table>
  </body>
</html>`;
}

function escapeHtml(value: string) {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;");
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
  const res = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${key}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ from, to: opts.to, subject: opts.subject, html: opts.html }),
  });
  if (!res.ok) {
    const text = await res.text();
    return { ok: false as const, error: text.slice(0, 180) };
  }
  const data = (await res.json()) as { id?: string };
  return { ok: true as const, id: data.id };
}
