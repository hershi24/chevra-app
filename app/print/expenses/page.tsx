import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { PrintToolbar } from "@/components/print-toolbar";
import { getSessionUser } from "@/lib/auth";
import { buildExpenseReport, reportScope } from "@/lib/expense-report";
import { expensesOpen, formatShekels } from "@/lib/expenses";
import { readState } from "@/lib/store";

export const dynamic = "force-dynamic";

export const metadata: Metadata = { title: "באו חשבון · הדפסה" };

function money(value: number) {
  return formatShekels(value);
}

const th = "border-b border-[#a9782c] bg-[#f5f0e7] px-2 py-1.5 font-medium";
const td = "border-b border-[#e3e7ec] px-2 py-1.5 align-top";
const num = "whitespace-nowrap text-end tabular-nums";
const thText = `${th} text-start`;
const thNum = `${th} ${num}`;

export default async function PrintExpensesPage({
  searchParams,
}: {
  searchParams: Promise<{ [key: string]: string | string[] | undefined }>;
}) {
  const me = await getSessionUser();
  if (!me) redirect("/login");
  const state = await readState();
  if (!expensesOpen(state)) redirect("/");
  const raw = (await searchParams).scope;
  const scope = reportScope(state, Array.isArray(raw) ? raw[0] : raw);
  const report = buildExpenseReport(state, scope);
  const stamp = new Intl.DateTimeFormat("he-IL", {
    dateStyle: "long",
    timeStyle: "short",
    timeZone: "Asia/Jerusalem",
  }).format(new Date());

  return (
    <div className="min-h-screen bg-[#eef1f4] py-6 print:bg-white print:py-0">
      <style>{`@page { size: A4; margin: 14mm 12mm; } @media print { html, body { background: #fff !important; } }`}</style>
      <PrintToolbar />
      <article className="mx-auto w-full max-w-[210mm] bg-white px-[12mm] py-[12mm] text-[12px] leading-5 text-[#1f2328] shadow-sm print:max-w-none print:p-0 print:shadow-none [-webkit-print-color-adjust:exact] [print-color-adjust:exact]">
        <header className="flex items-end justify-between gap-4 border-b-2 border-[#a9782c] pb-3">
          <div>
            <div className="text-[11px] text-[#6b7280]">{report.groupName}</div>
            <h1 className="text-[22px] font-medium text-[#a9782c]">באו חשבון</h1>
            <div className="text-[13px]">{report.scopeLabel}</div>
          </div>
          <div className="text-end text-[11px] text-[#6b7280]">הופק {stamp}</div>
        </header>

        <section className="mt-4 grid grid-cols-4 gap-2">
          {[
            ["נכנס לחשבון", money(report.totals.included)],
            ["חלק לכל חבר", report.totals.sharesEqual ? money(report.totals.share) : "שונה"],
            ["כבר הועבר", money(report.totals.paid)],
            ["מוחרג", money(report.totals.excluded)],
          ].map(([label, value]) => (
            <div key={label} className="rounded-[8px] border border-[#e3e7ec] px-3 py-2">
              <div className="text-[10.5px] text-[#6b7280]">{label}</div>
              <div className="text-[15px] font-medium tabular-nums">{value}</div>
            </div>
          ))}
        </section>
        <p className="mt-1.5 text-[10.5px] text-[#6b7280]">
          {report.totals.memberCount} חברים.{" "}
          {report.totals.sharesEqual
            ? "הסכום מתחלק שווה בשווה; מה שכל אחד קנה ומה שהעביר יורד מהחלק שלו."
            : "יש החרגות: מי שמוחרג לא משלם את החלק שלו, והשאר לא מכסים אותו."}
        </p>

        <h2 className="mt-5 mb-1.5 text-[14px] font-medium">סיכום לפי חבר</h2>
        <table className="w-full border-collapse">
          <thead>
            <tr>
              <th className={thText}>חבר</th>
              <th className={thNum}>קנה</th>
              <th className={thNum}>החלק שלו</th>
              <th className={thNum}>העביר</th>
              <th className={thNum}>קיבל</th>
              <th className={thNum}>יתרה</th>
            </tr>
          </thead>
          <tbody>
            {report.members.map((row) => (
              <tr key={row.name} className="break-inside-avoid">
                <td className={td}>{row.name}</td>
                <td className={`${td} ${num}`}>{money(row.spent)}</td>
                <td className={`${td} ${num}`}>{money(row.share)}</td>
                <td className={`${td} ${num}`}>{row.paid ? money(row.paid) : "—"}</td>
                <td className={`${td} ${num}`}>{row.received ? money(row.received) : "—"}</td>
                <td
                  className={`${td} ${num} font-medium ${
                    row.balance > 0 ? "text-[#8d6424]" : row.balance < 0 ? "text-[#a4453a]" : "text-[#6b7280]"
                  }`}
                >
                  {row.balance === 0 ? "מאוזן" : `${row.status} ${money(Math.abs(row.balance))}`}
                </td>
              </tr>
            ))}
          </tbody>
        </table>

        <h2 className="mt-5 mb-1.5 text-[14px] font-medium">מי מעביר למי</h2>
        {report.transfers.length ? (
          <table className="w-full border-collapse">
            <thead>
              <tr>
                <th className={thText}>מי מעביר</th>
                <th className={thText}>למי</th>
                <th className={thNum}>סכום</th>
              </tr>
            </thead>
            <tbody>
              {report.transfers.map((row) => (
                <tr key={`${row.from}-${row.to}`} className="break-inside-avoid">
                  <td className={td}>{row.from}</td>
                  <td className={td}>{row.to}</td>
                  <td className={`${td} ${num}`}>{money(row.amount)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        ) : (
          <p className="text-[#6b7280]">החשבון סגור, אין העברות פתוחות.</p>
        )}

        <h2 className="mt-5 mb-1.5 text-[14px] font-medium">הוצאות</h2>
        {report.expenses.length ? (
          <table className="w-full border-collapse">
            <thead>
              <tr>
                <th className={thText}>תאריך</th>
                <th className={thText}>מה נקנה</th>
                <th className={thText}>מי קנה</th>
                {report.showEvent ? <th className={thText}>חברה</th> : null}
                <th className={thNum}>סכום</th>
              </tr>
            </thead>
            <tbody>
              {report.expenses.map((row, index) => (
                <tr key={index} className={`break-inside-avoid ${row.excluded ? "text-[#9aa1ab]" : ""}`}>
                  <td className={`${td} whitespace-nowrap`}>{row.date}</td>
                  <td className={td}>
                    {row.title}
                    {row.excluded ? <span className="ms-1 text-[10.5px]">(מוחרג)</span> : null}
                    {row.exempt ? <div className="text-[10.5px] text-[#6b7280]">בלי {row.exempt}</div> : null}
                    {row.detail ? <div className="text-[10.5px] text-[#6b7280]">{row.detail}</div> : null}
                  </td>
                  <td className={td}>{row.buyer}</td>
                  {report.showEvent ? <td className={td}>{row.event || "—"}</td> : null}
                  <td className={`${td} ${num} ${row.excluded ? "line-through" : ""}`}>{money(row.amount)}</td>
                </tr>
              ))}
              <tr className="font-medium">
                <td className="px-2 py-1.5" colSpan={report.showEvent ? 4 : 3}>
                  סה״כ בחשבון
                </td>
                <td className={`px-2 py-1.5 ${num}`}>{money(report.totals.included)}</td>
              </tr>
            </tbody>
          </table>
        ) : (
          <p className="text-[#6b7280]">אין הוצאות.</p>
        )}

        <h2 className="mt-5 mb-1.5 text-[14px] font-medium">תשלומים שסומנו</h2>
        {report.payments.length ? (
          <table className="w-full border-collapse">
            <thead>
              <tr>
                <th className={thText}>תאריך</th>
                <th className={thText}>מי שילם</th>
                <th className={thText}>למי</th>
                <th className={thText}>איך</th>
                {report.showEvent ? <th className={thText}>חברה</th> : null}
                <th className={thNum}>סכום</th>
              </tr>
            </thead>
            <tbody>
              {report.payments.map((row, index) => (
                <tr key={index} className="break-inside-avoid">
                  <td className={`${td} whitespace-nowrap`}>{row.date}</td>
                  <td className={td}>{row.from}</td>
                  <td className={td}>
                    {row.to}
                    {row.note ? <div className="text-[10.5px] text-[#6b7280]">{row.note}</div> : null}
                  </td>
                  <td className={td}>{row.method || "—"}</td>
                  {report.showEvent ? <td className={td}>{row.event || "—"}</td> : null}
                  <td className={`${td} ${num}`}>{money(row.amount)}</td>
                </tr>
              ))}
              <tr className="font-medium">
                <td className="px-2 py-1.5" colSpan={report.showEvent ? 5 : 4}>
                  סה״כ הועבר
                </td>
                <td className={`px-2 py-1.5 ${num}`}>{money(report.totals.paid)}</td>
              </tr>
            </tbody>
          </table>
        ) : (
          <p className="text-[#6b7280]">עוד לא סומנו תשלומים.</p>
        )}
      </article>
    </div>
  );
}
