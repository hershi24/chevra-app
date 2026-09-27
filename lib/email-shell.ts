export const A = "direction:rtl;text-align:right;";
export const FONT = "'Secular One', Arial, Helvetica, sans-serif";
export const gold = "#a9782c";
export const goldSoft = "#f5f0e7";
export const ink = "#1f2328";
export const muted = "#6b7280";
export const faint = "#9aa1ab";
export const line = "#e3e7ec";
export const green = "#3d8f62";

export function escapeHtml(value: string) {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;");
}

export function firstName(displayName: string) {
  return displayName.trim().split(/\s+/)[0] || displayName;
}

export function kicker(text: string) {
  return `<div style="font-size:12px;color:${gold};letter-spacing:.02em;${A}">${text}</div>`;
}

export function heading(text: string) {
  return `<h1 style="margin:6px 0 0;font-size:26px;line-height:1.25;font-weight:400;color:${ink};font-family:${FONT};${A}">${text}</h1>`;
}

export function paragraph(text: string) {
  return `<p style="margin:14px 0 0;font-size:15px;line-height:1.75;color:#3f4650;${A}">${text}</p>`;
}

export function emailShell(opts: { origin: string; title: string; preheader: string; inner: string }) {
  return `<!doctype html>
<html lang="he" dir="rtl">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <title>${opts.title}</title>
    <link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Secular+One&display=swap" />
  </head>
  <body dir="rtl" style="margin:0;padding:0;background:#f3f4f6;${A}">
    <div style="display:none;max-height:0;overflow:hidden;opacity:0;">${opts.preheader}</div>
    <table role="presentation" dir="rtl" width="100%" cellpadding="0" cellspacing="0" style="background:#f3f4f6;padding:28px 12px;font-family:${FONT};color:${ink};${A}">
      <tr><td align="center">
        <table role="presentation" dir="rtl" width="100%" cellpadding="0" cellspacing="0" style="max-width:560px;${A}">
          <tr><td align="center" style="padding:0 0 18px;">
            <img src="${opts.origin}/brand-logo.png" alt="מיין חברה" width="84" height="44" style="display:block;height:44px;width:auto;border:0;" />
          </td></tr>
          <tr><td style="background:#fbfcfd;border:1px solid #d5dbe3;border-radius:22px;overflow:hidden;${A}">
            <table role="presentation" dir="rtl" width="100%" cellpadding="0" cellspacing="0">
              <tr><td style="height:4px;background:${gold};font-size:0;line-height:0;">&nbsp;</td></tr>
              <tr><td dir="rtl" style="padding:30px 28px;${A}">${opts.inner}</td></tr>
            </table>
          </td></tr>
          <tr><td align="center" style="padding:18px 20px 0;font-size:12px;line-height:1.7;color:${faint};font-family:${FONT};">
            ${opts.preheader}<br />מיין חברה · אש קודש
          </td></tr>
        </table>
      </td></tr>
    </table>
  </body>
</html>`;
}
