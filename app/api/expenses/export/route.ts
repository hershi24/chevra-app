import ExcelJS from "exceljs";
import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import { getSessionUser } from "@/lib/auth";
import { buildExpenseReport, reportFileName, reportScope } from "@/lib/expense-report";
import { expensesOpen } from "@/lib/expenses";
import { readState } from "@/lib/store";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const MONEY = '#,##0.00 "₪";-#,##0.00 "₪"';
const GOLD = "FFA9782C";
const HEADER_FILL = "FFF5F0E7";
const LINE = "FFD5DBE3";

type Column = { header: string; key: string; width: number; money?: boolean };

function addTable(
  book: ExcelJS.Workbook,
  name: string,
  title: string,
  subtitle: string,
  columns: Column[],
  rows: Record<string, string | number>[],
  footer?: Record<string, string | number>
) {
  const sheet = book.addWorksheet(name, {
    views: [{ rightToLeft: true, state: "frozen", ySplit: 4 }],
    pageSetup: { orientation: "portrait", fitToPage: true, fitToWidth: 1, fitToHeight: 0, paperSize: 9 },
  });
  sheet.columns = columns.map((column) => ({ key: column.key, width: column.width }));

  sheet.mergeCells(1, 1, 1, columns.length);
  const head = sheet.getCell(1, 1);
  head.value = title;
  head.font = { bold: true, size: 15, color: { argb: GOLD } };
  head.alignment = { horizontal: "right" };
  sheet.mergeCells(2, 1, 2, columns.length);
  const sub = sheet.getCell(2, 1);
  sub.value = subtitle;
  sub.font = { size: 10, color: { argb: "FF6B7280" } };
  sub.alignment = { horizontal: "right" };

  const header = sheet.getRow(4);
  columns.forEach((column, index) => {
    const cell = header.getCell(index + 1);
    cell.value = column.header;
    cell.font = { bold: true };
    cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: HEADER_FILL } };
    cell.border = { bottom: { style: "thin", color: { argb: GOLD } } };
    cell.alignment = { horizontal: "right", vertical: "middle" };
  });
  header.height = 20;

  const body = footer ? [...rows, footer] : rows;
  body.forEach((values, rowIndex) => {
    const row = sheet.getRow(5 + rowIndex);
    columns.forEach((column, index) => {
      const cell = row.getCell(index + 1);
      cell.value = values[column.key] ?? "";
      cell.alignment = { horizontal: "right", vertical: "top", wrapText: true };
      cell.border = { bottom: { style: "hair", color: { argb: LINE } } };
      if (column.money && typeof cell.value === "number") cell.numFmt = MONEY;
    });
    if (footer && rowIndex === body.length - 1) {
      row.font = { bold: true };
      row.eachCell((cell) => {
        cell.border = { top: { style: "thin", color: { argb: GOLD } } };
      });
    }
  });
  if (!rows.length) {
    const cell = sheet.getCell(5, 1);
    cell.value = "אין רשומות";
    cell.font = { italic: true, color: { argb: "FF9AA1AB" } };
  }
  return sheet;
}

export async function GET(request: NextRequest) {
  const me = await getSessionUser();
  if (!me) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const state = await readState();
  if (!expensesOpen(state)) return NextResponse.json({ error: "הדף מוסתר" }, { status: 403 });

  const scope = reportScope(state, request.nextUrl.searchParams.get("scope"));
  const report = buildExpenseReport(state, scope);
  const stamp = new Intl.DateTimeFormat("he-IL", { dateStyle: "medium", timeStyle: "short" }).format(new Date());
  const subtitle = `${report.groupName} · ${report.scopeLabel} · הופק ${stamp}`;

  const book = new ExcelJS.Workbook();
  book.creator = report.groupName;
  book.created = new Date();

  addTable(
    book,
    "סיכום",
    "באו חשבון · סיכום",
    subtitle,
    [
      { header: "חבר", key: "name", width: 22 },
      { header: "קנה", key: "spent", width: 13, money: true },
      { header: "החלק שלו", key: "share", width: 13, money: true },
      { header: "העביר", key: "paid", width: 13, money: true },
      { header: "קיבל", key: "received", width: 13, money: true },
      { header: "יתרה", key: "balance", width: 13, money: true },
      { header: "מצב", key: "status", width: 11 },
    ],
    report.members,
    {
      name: `סה״כ · ${report.totals.memberCount} חברים`,
      spent: report.totals.included,
      share: report.totals.included,
      paid: report.totals.paid,
      received: report.totals.paid,
      balance: "",
      status: "",
    }
  );

  addTable(
    book,
    "הוצאות",
    "באו חשבון · הוצאות",
    subtitle,
    [
      { header: "תאריך", key: "date", width: 13 },
      { header: "מה נקנה", key: "title", width: 24 },
      { header: "מי קנה", key: "buyer", width: 18 },
      ...(report.showEvent ? [{ header: "חברה", key: "event", width: 26 }] : []),
      { header: "פירוט", key: "detail", width: 30 },
      { header: "בחשבון", key: "status", width: 10 },
      { header: "סכום", key: "amount", width: 13, money: true },
    ],
    report.expenses.map(({ excluded, ...item }) => ({ ...item, status: excluded ? "מוחרג" : "כן" })),
    { date: "סה״כ בחשבון", amount: report.totals.included }
  );

  addTable(
    book,
    "תשלומים",
    "באו חשבון · תשלומים שסומנו",
    subtitle,
    [
      { header: "תאריך", key: "date", width: 13 },
      { header: "מי שילם", key: "from", width: 18 },
      { header: "למי", key: "to", width: 18 },
      { header: "איך", key: "method", width: 10 },
      ...(report.showEvent ? [{ header: "חברה", key: "event", width: 26 }] : []),
      { header: "הערה", key: "note", width: 26 },
      { header: "סכום", key: "amount", width: 13, money: true },
    ],
    report.payments,
    { date: "סה״כ הועבר", amount: report.totals.paid }
  );

  addTable(
    book,
    "העברות פתוחות",
    "באו חשבון · מי מעביר למי",
    subtitle,
    [
      { header: "מי מעביר", key: "from", width: 20 },
      { header: "למי", key: "to", width: 20 },
      { header: "סכום", key: "amount", width: 13, money: true },
    ],
    report.transfers
  );

  const buffer = await book.xlsx.writeBuffer();
  const file = reportFileName(report, "xlsx");
  return new NextResponse(Buffer.from(buffer), {
    headers: {
      "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "Content-Disposition": `attachment; filename="expenses.xlsx"; filename*=UTF-8''${encodeURIComponent(file)}`,
      "Cache-Control": "no-store",
    },
  });
}
