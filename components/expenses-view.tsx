"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { ArrowLeft, Check, CheckCircle2, Copy, FileSpreadsheet, HandCoins, Pencil, Plus, Printer, Trash2, Wallet } from "lucide-react";
import { toast } from "sonner";
import { useApp } from "@/components/app-provider";
import { BankAccounts } from "@/components/bank-accounts";
import { UserAvatar } from "@/components/user-avatar";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import {
  PAYMENT_METHODS,
  SCOPE_ALL,
  SCOPE_NONE,
  canEditExpense,
  canEditPayment,
  exemptMemberIds,
  expensesOpen,
  formatAgorot,
  formatShekels,
  paymentMethodLabel,
  scopedSettlement,
  type ExpenseScope,
  type Settlement,
  type Transfer,
} from "@/lib/expenses";
import { formatDateShortHe, gatheringLabel, memberById } from "@/lib/format";
import { isAdmin } from "@/lib/permissions";
import { upcomingGathering } from "@/lib/selectors";
import type {
  BankAccount,
  Expense,
  ExpensePayment,
  Gathering,
  GatheringWaiver,
  Member,
  PaymentMethod,
} from "@/lib/types";
import { cn } from "@/lib/utils";

const panel = "rounded-[20px] border border-[#d5dbe3] bg-[#fbfcfd]";
const exportLink =
  "inline-flex items-center gap-1.5 rounded-full border border-[#dfe3e8] bg-[#fbfcfd] px-3.5 py-1.5 text-[13px] text-foreground/80 hover:text-foreground";
const selectClass =
  "h-8 w-full rounded-[10px] border border-input bg-transparent px-2.5 text-sm text-foreground";

function fail(fallback: string) {
  return (error: unknown) => toast.error(error instanceof Error ? error.message : fallback);
}

function noticeSent(base: string) {
  return (data: unknown) => {
    const sent = (data as { mail?: { sent: number } } | undefined)?.mail?.sent ?? 0;
    if (!sent) return void toast.success(base);
    toast.success(`${base} · ${sent === 1 ? "נשלח גם מייל" : `נשלחו גם ${sent} מיילים`}`);
  };
}

function eventName(gatherings: Gathering[], id?: string) {
  if (!id) return null;
  const event = gatherings.find((item) => item.id === id);
  return event ? `${gatheringLabel(event)} · ${formatDateShortHe(event.startsAt)}` : null;
}

type Tab = "expenses" | "payments" | "members" | "bank";

export function ExpensesView() {
  const { state, me } = useApp();
  const router = useRouter();
  const hidden = Boolean(state && !expensesOpen(state));
  const [picked, setPicked] = useState<ExpenseScope>(SCOPE_ALL);
  const [tab, setTab] = useState<Tab>("expenses");

  useEffect(() => {
    if (hidden) router.replace("/");
  }, [hidden, router]);

  if (!state || !me || hidden) return null;

  const upcoming = upcomingGathering(state);
  const allExpenses = state.expenses ?? [];
  const allPayments = state.payments ?? [];
  const accounts = state.bankAccounts ?? {};
  const gatherings = [...state.gatherings]
    .filter((event) => event.status !== "cancelled")
    .sort((a, b) => +new Date(b.startsAt) - +new Date(a.startsAt));

  const used = new Set(
    [...allExpenses, ...allPayments].map((item) => item.eventId).filter(Boolean) as string[]
  );
  if (upcoming) used.add(upcoming.id);
  const scopeEvents = gatherings.filter((event) => used.has(event.id));
  const hasUnassigned = [...allExpenses, ...allPayments].some((item) => !item.eventId);
  const scope =
    picked === SCOPE_ALL ||
    (picked === SCOPE_NONE && hasUnassigned) ||
    scopeEvents.some((event) => event.id === picked)
      ? picked
      : SCOPE_ALL;
  const scopeEventId = scope !== SCOPE_ALL && scope !== SCOPE_NONE ? scope : undefined;

  const { expenses, payments, report, transfers } = scopedSettlement(state, scope);
  const defaultEventId = scopeEventId ?? (scope === SCOPE_NONE ? undefined : upcoming?.id);

  const chips: { id: ExpenseScope; label: string }[] = [
    { id: SCOPE_ALL, label: "כל החברות" },
    ...scopeEvents.map((event) => ({
      id: event.id,
      label: `${gatheringLabel(event)} · ${formatDateShortHe(event.startsAt)}`,
    })),
    ...(hasUnassigned ? [{ id: SCOPE_NONE, label: "בלי חברה מסוימת" }] : []),
  ];
  const tabs: { id: Tab; label: string; hint: string; count?: number }[] = [
    {
      id: "expenses",
      label: "מה נקנה",
      hint: "כל מה שחבר קנה בשביל החברה. הסכום מתחלק בין כל החברים.",
      count: expenses.length,
    },
    {
      id: "payments",
      label: "מי שילם",
      hint: "כסף שכבר עבר בין החברים. מי שהעביר רושם כאן, והחשבון מתעדכן.",
      count: payments.length,
    },
    { id: "members", label: "כל החברים", hint: "כמה כל אחד קנה, מה החלק שלו, ומי עוד צריך להעביר למי." },
    { id: "bank", label: "פרטי בנק", hint: "לאן מעבירים כסף. כל חבר יכול למלא את הפרטים שלו." },
  ];
  const activeTab = tabs.find((item) => item.id === tab) ?? tabs[0];

  return (
    <div className="flex flex-col">
      <header className="flex flex-wrap items-end justify-between gap-x-4 gap-y-3">
        <div className="min-w-0">
          <h1 className="text-[1.75rem] font-medium leading-tight tracking-tight md:text-[2.1rem]">באו חשבון</h1>
          <p className="mt-1 max-w-xl text-[14px] font-light leading-6 text-muted-foreground">
            רושמים כאן מה כל אחד קנה בשביל החברה, והאתר מחשב לבד מי צריך להעביר כסף ולמי.
          </p>
        </div>
        <div className="flex shrink-0 gap-2">
          <a href={`/api/expenses/export?scope=${encodeURIComponent(scope)}`} download className={exportLink}>
            <FileSpreadsheet className="size-4 text-[#3d8f62]" />
            הורדה לאקסל
          </a>
          <a
            href={`/print/expenses?scope=${encodeURIComponent(scope)}`}
            target="_blank"
            rel="noopener"
            className={exportLink}
          >
            <Printer className="size-4 text-[#6b7280]" />
            הדפסה
          </a>
        </div>
      </header>

      {chips.length > 1 ? (
        <div className="mt-5">
          <div className="mb-2 text-[13px] text-muted-foreground">להציג את החשבון של:</div>
          <nav
            aria-label="איזו חברה להציג"
            className="-mx-5 flex gap-2 overflow-x-auto px-5 pb-1 [scrollbar-width:none] sm:mx-0 sm:flex-wrap sm:px-0 [&::-webkit-scrollbar]:hidden"
          >
            {chips.map((chip) => (
              <button
                key={chip.id}
                type="button"
                aria-pressed={scope === chip.id}
                onClick={() => setPicked(chip.id)}
                className={cn(
                  "shrink-0 rounded-full border px-4 py-2 text-[13.5px] transition-colors",
                  scope === chip.id
                    ? "border-[#a9782c] bg-[#f5f0e7] text-[#7d5a22]"
                    : "border-[#dfe3e8] bg-white text-foreground/75 hover:text-foreground"
                )}
              >
                {chip.label}
              </button>
            ))}
          </nav>
        </div>
      ) : null}

      <StatusCard
        key={scope}
        me={me}
        members={state.members}
        accounts={accounts}
        gatherings={gatherings}
        report={report}
        transfers={transfers}
        scope={scope}
        eventId={scopeEventId}
      />

      {scopeEventId ? (
        <div className="mt-4">
          <GatheringExempt
            eventId={scopeEventId}
            members={state.members}
            waivers={state.expenseWaivers ?? []}
            admin={isAdmin(me)}
          />
        </div>
      ) : null}

      <div role="tablist" aria-label="חלקי החשבון" className="mt-7 grid grid-cols-4 gap-1 rounded-full bg-[#eef0f3] p-1">
        {tabs.map((item) => (
          <button
            key={item.id}
            type="button"
            role="tab"
            aria-selected={tab === item.id}
            onClick={() => setTab(item.id)}
            className={cn(
              "min-w-0 rounded-full px-1.5 py-2 text-[13px] transition-colors sm:text-[14.5px]",
              tab === item.id
                ? "bg-white text-foreground shadow-[0_1px_3px_rgba(16,24,40,0.12)]"
                : "text-muted-foreground hover:text-foreground"
            )}
          >
            <span className="truncate">{item.label}</span>
            {item.count ? <span className="ms-1 text-[#9aa1ab] tabular-nums">{item.count}</span> : null}
          </button>
        ))}
      </div>
      <p className="mt-3 text-[13px] font-light text-muted-foreground">{activeTab.hint}</p>

      <div className="mt-3">
        {tab === "expenses" ? (
          <>
            <ExpenseList
              key={`expenses-${scope}`}
              expenses={expenses}
              members={state.members}
              gatherings={gatherings}
              waivers={state.expenseWaivers ?? []}
              me={me}
              showEvent={scope === SCOPE_ALL}
              defaultEventId={defaultEventId}
            />
            <p className="mt-3 text-[13px] font-light text-muted-foreground">
              {[
                `סך הכל ${formatAgorot(report.includedAgorot)}`,
                `מתחלק בין ${report.memberCount} חברים`,
                report.sharesEqual ? `${formatAgorot(report.shareAgorot)} לכל אחד` : "לא כולם משתתפים בכל קנייה",
                report.excludedAgorot ? `${formatAgorot(report.excludedAgorot)} רשום בלי חלוקה` : "",
              ]
                .filter(Boolean)
                .join(" · ")}
            </p>
          </>
        ) : tab === "payments" ? (
          <PaymentList
            key={`payments-${scope}`}
            payments={payments}
            members={state.members}
            gatherings={gatherings}
            me={me}
            showEvent={scope === SCOPE_ALL}
            defaultEventId={defaultEventId}
          />
        ) : tab === "members" ? (
          <MembersTab
            me={me}
            members={state.members}
            accounts={accounts}
            gatherings={gatherings}
            report={report}
            transfers={transfers}
            scope={scope}
            eventId={scopeEventId}
          />
        ) : (
          <BankAccounts members={state.members} accounts={accounts} me={me} />
        )}
      </div>
    </div>
  );
}

function StatusCard({
  me,
  members,
  accounts,
  gatherings,
  report,
  transfers,
  scope,
  eventId,
}: {
  me: Member;
  members: Member[];
  accounts: Record<string, BankAccount>;
  gatherings: Gathering[];
  report: Settlement;
  transfers: Transfer[];
  scope: ExpenseScope;
  eventId?: string;
}) {
  const { act } = useApp();
  const admin = isAdmin(me);
  const [open, setOpen] = useState<{ key: string; method: PaymentMethod } | null>(null);
  const [sending, setSending] = useState(false);
  const busy = useRef(false);
  const row = report.rows.find((item) => item.memberId === me.id);
  const name = (id: string) => memberById(members, id)?.displayName ?? "חבר";
  const toPay = transfers.filter((item) => item.fromId === me.id);
  const toGet = transfers.filter((item) => item.toId === me.id);
  const openAgorot = report.rows.reduce((sum, item) => sum + item.owesAgorot, 0);
  const totalFlow = openAgorot + report.paymentsAgorot;
  const debtors = report.rows.filter((item) => item.owesAgorot > 0 && item.memberId !== me.id).length;
  const firstName = me.displayName.split(" ")[0];

  const headline = !row
    ? { tone: "even" as const, title: "אין חשבון להצגה", text: "עוד לא נרשמו קניות." }
    : row.owesAgorot > 0
      ? {
          tone: "owe" as const,
          title: `אתה צריך להעביר ${formatAgorot(row.owesAgorot)}`,
          text:
            toPay.length === 1
              ? `ל${name(toPay[0].toId)}. אחרי שהעברת, לחץ על ״שילמתי״ כדי שהחשבון יתעדכן.`
              : `ל־${toPay.length} חברים, הפירוט כאן למטה. אחרי כל העברה לחץ על ״שילמתי״.`,
        }
      : row.balanceAgorot > 0
        ? {
            tone: "get" as const,
            title: `מגיע לך ${formatAgorot(row.balanceAgorot)}`,
            text: "קנית יותר מהחלק שלך. החברים שכתובים כאן למטה צריכים להעביר לך.",
          }
        : { tone: "even" as const, title: "אתה לא חייב כלום", text: "החשבון שלך מאוזן. אין מה להעביר." };

  const tiles = row
    ? [
        { label: "החלק שלך בהוצאות", value: row.shareAgorot },
        { label: "מה שקנית", value: row.spentAgorot },
        row.receivedAgorot && !row.paidAgorot
          ? { label: "מה שקיבלת", value: row.receivedAgorot }
          : { label: "מה שכבר העברת", value: row.paidAgorot },
      ]
    : [];

  const form = (item: Transfer, method: PaymentMethod) => (
    <div className="mt-3">
      <PaymentForm
        members={members}
        gatherings={gatherings}
        me={me}
        title="רישום התשלום"
        initial={{ fromId: item.fromId, toId: item.toId, amount: item.amountAgorot / 100, eventId, method }}
        onDone={() => setOpen(null)}
      />
    </div>
  );

  const Icon = headline.tone === "owe" ? HandCoins : headline.tone === "get" ? Wallet : CheckCircle2;

  return (
    <section className={cn(panel, "mt-5 overflow-hidden")}>
      <div className="p-5 md:p-6">
        <div className="text-[13px] text-muted-foreground">המצב שלך, {firstName}</div>
        <div className="mt-2 flex items-start gap-3.5">
          <span
            className={cn(
              "grid size-11 shrink-0 place-items-center rounded-2xl",
              headline.tone === "owe"
                ? "bg-[#fbeee9] text-[#a4453a]"
                : headline.tone === "get"
                  ? "bg-[#f5f0e7] text-[#a9782c]"
                  : "bg-[#e6f2ea] text-[#3d8f62]"
            )}
          >
            <Icon className="size-5" />
          </span>
          <div className="min-w-0">
            <h2
              className={cn(
                "text-[1.45rem] leading-tight tabular-nums md:text-[1.7rem]",
                headline.tone === "owe" ? "text-[#8d3a32]" : headline.tone === "get" ? "text-[#7d5a22]" : "text-[#2f7350]"
              )}
            >
              {headline.title}
            </h2>
            <p className="mt-1 text-[14px] font-light leading-6 text-foreground/75">{headline.text}</p>
          </div>
        </div>

        {tiles.length ? (
          <div className="mt-5 grid grid-cols-3 gap-2">
            {tiles.map((tile) => (
              <div key={tile.label} className="rounded-2xl border border-[#e9ecef] bg-white px-3 py-2.5">
                <div className="text-[11.5px] leading-4 text-muted-foreground">{tile.label}</div>
                <div className="mt-1 text-[16px] tabular-nums md:text-[17px]">{formatAgorot(tile.value)}</div>
              </div>
            ))}
          </div>
        ) : null}
      </div>

      {toPay.length ? (
        <div className="grid gap-3 border-t border-[#e9ecef] bg-[#fdf8f6] p-4 md:p-5">
          <div className="text-[13px] text-muted-foreground">למי להעביר</div>
          {toPay.map((item) => {
            const key = `${item.fromId}-${item.toId}`;
            const account = accounts[item.toId];
            return (
              <div key={key} className="rounded-2xl border border-[#eadfd9] bg-white p-4">
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div className="flex min-w-0 items-center gap-2.5">
                    <UserAvatar member={memberById(members, item.toId)} size="sm" />
                    <div className="min-w-0">
                      <div className="truncate text-[15px]">{name(item.toId)}</div>
                      <div className="text-[14px] tabular-nums text-[#8d3a32]">{formatAgorot(item.amountAgorot)}</div>
                    </div>
                  </div>
                  {open?.key !== key ? (
                    <div className="flex gap-2">
                      <Button className="rounded-full" onClick={() => setOpen({ key, method: "transfer" })}>
                        שילמתי בהעברה
                      </Button>
                      <Button variant="outline" className="rounded-full" onClick={() => setOpen({ key, method: "cash" })}>
                        שילמתי במזומן
                      </Button>
                    </div>
                  ) : null}
                </div>
                {account ? (
                  <BankBox account={account} />
                ) : (
                  <p className="mt-3 text-[13px] font-light text-muted-foreground">
                    ל{name(item.toId)} עוד אין פרטי בנק באתר. אפשר לשלם במזומן, או לבקש ממנו את הפרטים.
                  </p>
                )}
                {open?.key === key ? form(item, open.method) : null}
              </div>
            );
          })}
        </div>
      ) : null}

      {toGet.length ? (
        <div className="border-t border-[#e9ecef] bg-[#fbf8f2] p-4 md:p-5">
          <div className="mb-1 text-[13px] text-muted-foreground">מי צריך להעביר לך</div>
          <div className="divide-y divide-[#eee6d8]">
            {toGet.map((item) => {
              const key = `${item.fromId}-${item.toId}`;
              return (
                <div key={key} className="py-3">
                  <div className="flex items-center justify-between gap-3">
                    <div className="flex min-w-0 items-center gap-2.5">
                      <UserAvatar member={memberById(members, item.fromId)} size="sm" />
                      <div className="min-w-0">
                        <div className="truncate text-[14.5px]">{name(item.fromId)}</div>
                        <div className="text-[13px] tabular-nums text-[#7d5a22]">{formatAgorot(item.amountAgorot)}</div>
                      </div>
                    </div>
                    {open?.key !== key ? (
                      <Button
                        size="sm"
                        variant="outline"
                        className="shrink-0 rounded-full"
                        onClick={() => setOpen({ key, method: "transfer" })}
                      >
                        קיבלתי את הכסף
                      </Button>
                    ) : null}
                  </div>
                  {open?.key === key ? form(item, open.method) : null}
                </div>
              );
            })}
          </div>
        </div>
      ) : null}

      {totalFlow > 0 ? (
        <div className="border-t border-[#e9ecef] px-5 py-4 md:px-6">
          <div className="flex justify-between gap-3 text-[13px] text-muted-foreground">
            <span>כמה מהחשבון כבר שולם</span>
            <span className="tabular-nums text-foreground/80">
              {formatAgorot(report.paymentsAgorot)} מתוך {formatAgorot(totalFlow)}
            </span>
          </div>
          <div className="mt-2 h-2 overflow-hidden rounded-full bg-[#eef0f3]">
            <div
              className="h-full rounded-full bg-[#3d8f62]"
              style={{ width: `${Math.max(3, Math.round((report.paymentsAgorot / totalFlow) * 100))}%` }}
            />
          </div>
        </div>
      ) : null}

      {admin ? (
        <div className="flex flex-wrap items-center justify-between gap-3 border-t border-[#e9ecef] bg-[#f6f7f9] px-5 py-3.5 md:px-6">
          <span className="text-[13px] text-foreground/75">
            {debtors
              ? `${debtors === 1 ? "חבר אחד עוד צריך" : `${debtors} חברים עוד צריכים`} לשלם, סך הכל ${formatAgorot(openAgorot)}`
              : "כולם מסודרים, אף אחד לא חייב כסף"}
          </span>
          {debtors ? (
            <Button
              variant="outline"
              size="sm"
              disabled={sending}
              className="rounded-full"
              onClick={() => {
                if (busy.current) return;
                busy.current = true;
                setSending(true);
                void act({ type: "sendExpenseNotice", scope })
                  .then(noticeSent("נשלחה תזכורת לכל מי שצריך לשלם"))
                  .catch(fail("השליחה נכשלה"))
                  .finally(() => {
                    busy.current = false;
                    setSending(false);
                  });
              }}
            >
              {sending ? "שולח…" : "שליחת תזכורת לכל מי שחייב"}
            </Button>
          ) : null}
        </div>
      ) : null}
    </section>
  );
}

function BankBox({ account }: { account: BankAccount }) {
  const bankLine = [account.holder, account.bank, account.branch ? `סניף ${account.branch}` : ""]
    .filter(Boolean)
    .join(" · ");
  return (
    <div className="mt-3 grid gap-3 rounded-xl bg-[#f6f7f9] px-3.5 py-3 md:grid-cols-[minmax(0,1fr)_auto] md:items-center">
      <div className="min-w-0 text-[13px] font-light leading-6 text-foreground/75">
        {bankLine ? <div className="truncate">{bankLine}</div> : null}
        <div className="flex flex-wrap items-baseline gap-x-3">
          {account.account ? (
            <span>
              מספר חשבון{" "}
              <span dir="ltr" className="text-[15px] text-foreground tabular-nums">
                {account.account}
              </span>
            </span>
          ) : null}
          {account.phone ? (
            <span>
              ביט / פייבוקס{" "}
              <span dir="ltr" className="text-foreground tabular-nums">
                {account.phone}
              </span>
            </span>
          ) : null}
        </div>
        {account.note ? <div className="text-muted-foreground">{account.note}</div> : null}
      </div>
      <div className="flex flex-wrap gap-2">
        {account.account ? <CopyPill label="העתקת מספר החשבון" value={account.account} /> : null}
        {account.phone ? <CopyPill label="העתקת הטלפון" value={account.phone} /> : null}
      </div>
    </div>
  );
}

function CopyPill({ label, value }: { label: string; value: string }) {
  const [copied, setCopied] = useState(false);
  return (
    <button
      type="button"
      onClick={async () => {
        try {
          await navigator.clipboard.writeText(value);
          setCopied(true);
          toast.success("הועתק");
          setTimeout(() => setCopied(false), 1500);
        } catch {
          toast.error("ההעתקה נכשלה");
        }
      }}
      className="inline-flex items-center gap-1.5 rounded-full border border-[#dfe3e8] bg-white px-3 py-1.5 text-[12.5px] text-foreground/80 hover:text-foreground"
    >
      {copied ? <Check className="size-3.5 text-[#3d8f62]" /> : <Copy className="size-3.5" />}
      {label}
    </button>
  );
}

function AddRow({ label, onClick }: { label: string; onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="flex w-full items-center gap-3 px-4 py-3.5 text-start text-[#a9782c] hover:bg-[#f5f0e7]/50"
    >
      <span className="inline-flex size-8 items-center justify-center rounded-full bg-[#f5f0e7]">
        <Plus className="size-4" />
      </span>
      {label}
    </button>
  );
}

function RowActions({ children }: { children: React.ReactNode }) {
  return <div className="flex flex-wrap gap-2 pe-4 ps-[3.75rem] pb-3.5">{children}</div>;
}

function GatheringExempt({
  eventId,
  members,
  waivers,
  admin,
}: {
  eventId: string;
  members: Member[];
  waivers: GatheringWaiver[];
  admin: boolean;
}) {
  const { act } = useApp();
  const [pending, setPending] = useState<string | null>(null);
  const selected = new Set(waivers.find((item) => item.eventId === eventId)?.memberIds ?? []);
  if (!admin && selected.size === 0) return null;

  return (
    <section className={cn(panel, "px-4 py-3.5")}>
      <div className="text-[15px]">מי לא משתתף בהוצאות של החברה הזו</div>
      <p className="mt-0.5 text-xs font-light text-muted-foreground">
        לחצו על שם כדי שהוא לא יחויב. זה חל גם על קניות שיירשמו בהמשך.
      </p>
      <div className="mt-2.5">
        {admin ? (
          <MemberToggles
            members={members}
            selected={selected}
            pending={pending}
            onToggle={(memberId, exempt) => {
              setPending(memberId);
              void act({ type: "setGatheringExempt", eventId, memberId, exempt })
                .catch(fail("ההחרגה נכשלה"))
                .finally(() => setPending(null));
            }}
          />
        ) : (
          <p className="text-sm">
            {members
              .filter((member) => selected.has(member.id))
              .map((member) => member.displayName)
              .join(" · ")}
          </p>
        )}
      </div>
    </section>
  );
}

function MemberToggles({
  members,
  selected,
  locked,
  pending,
  onToggle,
}: {
  members: Member[];
  selected: Set<string>;
  locked?: Set<string>;
  pending: string | null;
  onToggle: (memberId: string, exempt: boolean) => void;
}) {
  return (
    <div className="flex flex-wrap gap-1.5">
      {members.map((member) => {
        const held = locked?.has(member.id) ?? false;
        const on = held || selected.has(member.id);
        return (
          <button
            key={member.id}
            type="button"
            disabled={held || pending !== null}
            aria-pressed={on}
            title={held ? "לא משתתף בכל החברה" : undefined}
            onClick={() => onToggle(member.id, !selected.has(member.id))}
            className={cn(
              "rounded-full border px-3 py-1 text-[12.5px] transition-colors disabled:opacity-60",
              on
                ? "border-[#a9782c] bg-[#f5f0e7] text-[#7d5a22]"
                : "border-[#dfe3e8] text-foreground/75 hover:text-foreground"
            )}
          >
            {member.displayName}
          </button>
        );
      })}
    </div>
  );
}

function ExpenseList({
  expenses,
  members,
  gatherings,
  waivers,
  me,
  showEvent,
  defaultEventId,
}: {
  expenses: Expense[];
  members: Member[];
  gatherings: Gathering[];
  waivers: GatheringWaiver[];
  me: Member;
  showEvent: boolean;
  defaultEventId?: string;
}) {
  const { act } = useApp();
  const [active, setActive] = useState<string | null>(null);
  const [editing, setEditing] = useState<string | null>(null);
  const [adding, setAdding] = useState(false);
  const [pending, setPending] = useState<string | null>(null);
  const memberIds = members.map((member) => member.id);

  return (
    <div className={cn(panel, "divide-y divide-[#e9ecef] overflow-hidden")}>
      {expenses.length === 0 && !adding ? (
        <p className="px-5 py-6 text-sm font-light text-muted-foreground">
          {showEvent ? "עוד לא נרשמו קניות. קנית משהו לחברה? לחץ למטה ורשום מה קנית ובכמה." : "לחברה הזו עוד לא נרשמו קניות."}
        </p>
      ) : null}
      {expenses.map((expense) => {
        if (editing === expense.id) {
          return (
            <div key={expense.id} className="p-3">
              <ExpenseForm
                members={members}
                gatherings={gatherings}
                expense={expense}
                initial={expense}
                onDone={() => setEditing(null)}
              />
            </div>
          );
        }
        const buyer = memberById(members, expense.memberId);
        const editable = canEditExpense(me, expense);
        const exemptNames = expense.excluded
          ? []
          : exemptMemberIds(expense, memberIds, waivers).map(
              (id) => memberById(members, id)?.displayName ?? "חבר"
            );
        const locked = new Set(
          expense.eventId ? (waivers.find((item) => item.eventId === expense.eventId)?.memberIds ?? []) : []
        );
        const meta = [
          buyer?.displayName ?? "חבר",
          expense.detail.trim(),
          showEvent ? eventName(gatherings, expense.eventId) : null,
          expense.excluded ? "לא מתחלק בין החברים" : null,
          exemptNames.length ? `לא משתתפים: ${exemptNames.join(", ")}` : null,
        ].filter(Boolean);
        return (
          <div key={expense.id}>
            <button
              type="button"
              disabled={!editable}
              onClick={() => setActive(active === expense.id ? null : expense.id)}
              className={cn(
                "flex w-full items-center gap-3 px-4 py-3.5 text-start",
                editable && "hover:bg-[#f3f5f7]/60",
                expense.excluded && "opacity-55"
              )}
            >
              <UserAvatar member={buyer} />
              <div className="min-w-0 flex-1">
                <div className={cn("truncate text-[15px]", expense.excluded && "line-through")}>{expense.title}</div>
                <div className="truncate text-xs font-light text-muted-foreground">{meta.join(" · ")}</div>
              </div>
              <div className={cn("shrink-0 text-[15px] tabular-nums", expense.excluded && "line-through")}>
                {formatShekels(expense.amount)}
              </div>
            </button>
            {editable && active === expense.id ? (
              <RowActions>
                <Button variant="outline" size="sm" className="rounded-full" onClick={() => setEditing(expense.id)}>
                  <Pencil data-icon="inline-start" />
                  עריכה
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  className="rounded-full"
                  onClick={() =>
                    void act({
                      type: "setExpenseExcluded",
                      expenseId: expense.id,
                      excluded: !expense.excluded,
                    }).catch(fail("העדכון נכשל"))
                  }
                >
                  {expense.excluded ? "לחלק בין החברים" : "לא לחלק את הסכום"}
                </Button>
                <Button
                  variant="ghost"
                  size="sm"
                  className="rounded-full"
                  onClick={() =>
                    void act({ type: "deleteExpense", expenseId: expense.id }).catch(fail("המחיקה נכשלה"))
                  }
                >
                  <Trash2 data-icon="inline-start" />
                  מחיקה
                </Button>
                {expense.excluded ? null : (
                  <div className="basis-full">
                    <div className="mb-1.5 text-xs font-light text-muted-foreground">מי לא משתתף בקנייה הזו (לחצו על השם)</div>
                    <MemberToggles
                      members={members}
                      selected={new Set(expense.exemptIds ?? [])}
                      locked={locked}
                      pending={pending}
                      onToggle={(memberId, exempt) => {
                        setPending(memberId);
                        void act({ type: "setExpenseExempt", expenseId: expense.id, memberId, exempt })
                          .catch(fail("ההחרגה נכשלה"))
                          .finally(() => setPending(null));
                      }}
                    />
                  </div>
                )}
              </RowActions>
            ) : null}
          </div>
        );
      })}
      {adding ? (
        <div className="p-3">
          <ExpenseForm
            members={members}
            gatherings={gatherings}
            initial={{ memberId: me.id, eventId: defaultEventId }}
            onDone={() => setAdding(false)}
          />
        </div>
      ) : (
        <AddRow label="רישום קנייה חדשה" onClick={() => setAdding(true)} />
      )}
    </div>
  );
}

function PaymentList({
  payments,
  members,
  gatherings,
  me,
  showEvent,
  defaultEventId,
}: {
  payments: ExpensePayment[];
  members: Member[];
  gatherings: Gathering[];
  me: Member;
  showEvent: boolean;
  defaultEventId?: string;
}) {
  const { act } = useApp();
  const [active, setActive] = useState<string | null>(null);
  const [editing, setEditing] = useState<string | null>(null);
  const [adding, setAdding] = useState(false);
  const sorted = [...payments].sort((a, b) => b.createdAt.localeCompare(a.createdAt));

  return (
    <div className={cn(panel, "divide-y divide-[#e9ecef] overflow-hidden")}>
      {sorted.length === 0 && !adding ? (
        <p className="px-5 py-6 text-sm font-light text-muted-foreground">
          עוד לא נרשמו תשלומים. העברת כסף לחבר? רשום כאן למי, כמה ואיך.
        </p>
      ) : null}
      {sorted.map((payment) => {
        if (editing === payment.id) {
          return (
            <div key={payment.id} className="p-3">
              <PaymentForm
                members={members}
                gatherings={gatherings}
                me={me}
                payment={payment}
                initial={payment}
                onDone={() => setEditing(null)}
              />
            </div>
          );
        }
        const from = memberById(members, payment.fromId);
        const to = memberById(members, payment.toId)?.displayName ?? "חבר";
        const editable = canEditPayment(me, payment);
        const meta = [
          formatDateShortHe(payment.createdAt),
          paymentMethodLabel(payment.method),
          showEvent ? eventName(gatherings, payment.eventId) : null,
          payment.note.trim(),
        ].filter(Boolean);
        return (
          <div key={payment.id}>
            <button
              type="button"
              disabled={!editable}
              onClick={() => setActive(active === payment.id ? null : payment.id)}
              className={cn("flex w-full items-center gap-3 px-4 py-3.5 text-start", editable && "hover:bg-[#f3f5f7]/60")}
            >
              <UserAvatar member={from} />
              <div className="min-w-0 flex-1">
                <div className="flex min-w-0 items-center gap-1.5 text-[15px]">
                  <span className="truncate">{from?.displayName ?? "חבר"}</span>
                  <ArrowLeft className="size-3.5 shrink-0 text-[#9aa1ab]" />
                  <span className="truncate">{to}</span>
                </div>
                <div className="truncate text-xs font-light text-muted-foreground">{meta.join(" · ")}</div>
              </div>
              <div className="shrink-0 text-[15px] tabular-nums text-[#3d8f62]">{formatShekels(payment.amount)}</div>
            </button>
            {editable && active === payment.id ? (
              <RowActions>
                <Button variant="outline" size="sm" className="rounded-full" onClick={() => setEditing(payment.id)}>
                  <Pencil data-icon="inline-start" />
                  עריכה
                </Button>
                <Button
                  variant="ghost"
                  size="sm"
                  className="rounded-full"
                  onClick={() =>
                    void act({ type: "deletePayment", paymentId: payment.id }).catch(fail("המחיקה נכשלה"))
                  }
                >
                  <Trash2 data-icon="inline-start" />
                  מחיקה
                </Button>
              </RowActions>
            ) : null}
          </div>
        );
      })}
      {adding ? (
        <div className="p-3">
          <PaymentForm
            members={members}
            gatherings={gatherings}
            me={me}
            initial={{ fromId: me.id, eventId: defaultEventId, method: "transfer" }}
            onDone={() => setAdding(false)}
          />
        </div>
      ) : (
        <AddRow label="רישום תשלום" onClick={() => setAdding(true)} />
      )}
    </div>
  );
}

function MembersTab({
  me,
  members,
  accounts,
  gatherings,
  report,
  transfers,
  scope,
  eventId,
}: {
  me: Member;
  members: Member[];
  accounts: Record<string, BankAccount>;
  gatherings: Gathering[];
  report: Settlement;
  transfers: Transfer[];
  scope: ExpenseScope;
  eventId?: string;
}) {
  const { act } = useApp();
  const admin = isAdmin(me);
  const [open, setOpen] = useState<string | null>(null);
  const [sending, setSending] = useState<string | null>(null);
  const busy = useRef(false);

  return (
    <div className="space-y-5">
      <div className={cn(panel, "divide-y divide-[#e9ecef] overflow-hidden")}>
        {report.rows.map((row) => {
          const member = memberById(members, row.memberId);
          const moved = [
            report.sharesEqual ? "" : `החלק שלו ${formatAgorot(row.shareAgorot)}`,
            `קנה ${formatAgorot(row.spentAgorot)}`,
            row.paidAgorot ? `העביר ${formatAgorot(row.paidAgorot)}` : "",
            row.receivedAgorot ? `קיבל ${formatAgorot(row.receivedAgorot)}` : "",
          ].filter(Boolean);
          const pays = row.owesAgorot > 0;
          return (
            <div key={row.memberId} className="flex items-center gap-3 px-4 py-3">
              <UserAvatar member={member} />
              <div className="min-w-0 flex-1">
                <div className="truncate text-[15px]">
                  {member?.displayName ?? "חבר"}
                  {row.memberId === me.id ? <span className="text-muted-foreground"> · אני</span> : null}
                </div>
                <div className="truncate text-xs font-light text-muted-foreground">
                  {moved.join(" · ")}
                  {accounts[row.memberId] ? " · יש פרטי בנק" : ""}
                </div>
              </div>
              {row.balanceAgorot > 0 ? (
                <span className="shrink-0 rounded-full bg-[#f8edd9] px-2.5 py-1 text-[12px] tabular-nums text-[#8d6424]">
                  מגיע לו {formatAgorot(row.balanceAgorot)}
                </span>
              ) : pays ? (
                <span className="shrink-0 rounded-full bg-[#f8e7e4] px-2.5 py-1 text-[12px] tabular-nums text-[#8d3a32]">
                  צריך לשלם {formatAgorot(row.owesAgorot)}
                </span>
              ) : row.shareAgorot === 0 && report.includedAgorot > 0 && !report.sharesEqual ? (
                <span className="shrink-0 text-xs text-muted-foreground">לא משתתף</span>
              ) : (
                <span className="shrink-0 rounded-full bg-[#e6f2ea] px-2.5 py-1 text-[12px] text-[#3d8f62]">מסודר</span>
              )}
              {admin && pays && row.memberId !== me.id ? (
                <Button
                  size="sm"
                  variant="outline"
                  className="shrink-0 rounded-full"
                  disabled={sending !== null}
                  onClick={() => {
                    if (busy.current) return;
                    busy.current = true;
                    setSending(row.memberId);
                    void act({ type: "sendExpenseNotice", memberId: row.memberId, scope })
                      .then(noticeSent(`נשלחה תזכורת ל${member?.displayName ?? "חבר"}`))
                      .catch(fail("השליחה נכשלה"))
                      .finally(() => {
                        busy.current = false;
                        setSending(null);
                      });
                  }}
                >
                  {sending === row.memberId ? "שולח…" : "תזכורת"}
                </Button>
              ) : null}
            </div>
          );
        })}
      </div>
      {report.remainderAgorot > 0 ? (
        <p className="text-xs font-light text-[#9aa1ab]">
          {report.remainderAgorot} אגורות שלא מתחלקות שווה נוספו לחלק של כמה חברים, כדי שהחשבון ייסגר בדיוק.
        </p>
      ) : null}

      {transfers.length ? (
        <section>
          <h2 className="mb-2 text-[15px] font-medium">מי צריך להעביר למי</h2>
          <div className={cn(panel, "divide-y divide-[#e9ecef] overflow-hidden")}>
            {transfers.map((item) => {
              const key = `${item.fromId}-${item.toId}`;
              const canMark = admin || item.fromId === me.id || item.toId === me.id;
              return (
                <div key={key} className="px-4 py-3">
                  <div className="flex items-center justify-between gap-3">
                    <div className="flex min-w-0 items-center gap-1.5 text-[14px]">
                      <span className="truncate">{memberById(members, item.fromId)?.displayName ?? "חבר"}</span>
                      <ArrowLeft className="size-3.5 shrink-0 text-[#9aa1ab]" />
                      <span className="truncate">{memberById(members, item.toId)?.displayName ?? "חבר"}</span>
                    </div>
                    <div className="flex shrink-0 items-center gap-2">
                      <span className="text-[14px] tabular-nums">{formatAgorot(item.amountAgorot)}</span>
                      {canMark && open !== key ? (
                        <Button size="sm" variant="outline" className="rounded-full" onClick={() => setOpen(key)}>
                          סימון ששולם
                        </Button>
                      ) : null}
                    </div>
                  </div>
                  {open === key ? (
                    <div className="mt-3">
                      <PaymentForm
                        members={members}
                        gatherings={gatherings}
                        me={me}
                        title="רישום התשלום"
                        initial={{
                          fromId: item.fromId,
                          toId: item.toId,
                          amount: item.amountAgorot / 100,
                          eventId,
                          method: "transfer",
                        }}
                        onDone={() => setOpen(null)}
                      />
                    </div>
                  ) : null}
                </div>
              );
            })}
          </div>
        </section>
      ) : (
        <p className="text-sm font-light text-muted-foreground">אין העברות פתוחות, כולם מסודרים.</p>
      )}
    </div>
  );
}

function PaymentForm({
  members,
  gatherings,
  me,
  payment,
  title,
  initial,
  onDone,
}: {
  members: Member[];
  gatherings: Gathering[];
  me: Member;
  payment?: ExpensePayment;
  title?: string;
  initial: Partial<ExpensePayment>;
  onDone: () => void;
}) {
  const { act } = useApp();
  const admin = isAdmin(me);
  const [fromId, setFromId] = useState(initial.fromId ?? me.id);
  const [toId, setToId] = useState(
    initial.toId ?? members.find((member) => member.id !== (initial.fromId ?? me.id))?.id ?? ""
  );
  const [amount, setAmount] = useState(initial.amount ? String(initial.amount) : "");
  const [eventId, setEventId] = useState(initial.eventId ?? "");
  const [note, setNote] = useState(initial.note ?? "");
  const [method, setMethod] = useState<PaymentMethod | "">(initial.method ?? "");
  const [saving, setSaving] = useState(false);
  const toChoices = members.filter(
    (member) => member.id !== fromId && (admin || fromId === me.id || member.id === me.id)
  );
  const pickFrom = (next: string) => {
    setFromId(next);
    const allowed = members.filter(
      (member) => member.id !== next && (admin || next === me.id || member.id === me.id)
    );
    if (!allowed.some((member) => member.id === toId)) setToId(allowed[0]?.id ?? "");
  };

  return (
    <form
      className="space-y-3 rounded-[20px] border border-dashed border-[#d0d5dc] bg-white px-4 py-4"
      onSubmit={async (event) => {
        event.preventDefault();
        if (saving) return;
        setSaving(true);
        try {
          const fields = {
            fromId,
            toId,
            amount: Number(amount),
            method: method || null,
            eventId: eventId || null,
            note,
          };
          if (payment) await act({ type: "updatePayment", paymentId: payment.id, patch: fields });
          else await act({ type: "addPayment", ...fields });
          toast.success(payment ? "התשלום עודכן" : "התשלום סומן");
          onDone();
        } catch (error) {
          fail("השמירה נכשלה")(error);
        } finally {
          setSaving(false);
        }
      }}
    >
      {title ? <div className="text-sm font-medium">{title}</div> : null}
      <div className="grid gap-2 sm:grid-cols-2">
        <label className="grid gap-1 text-xs font-light text-muted-foreground">
          מי שילם
          <select value={fromId} onChange={(event) => pickFrom(event.target.value)} className={selectClass}>
            {members.map((member) => (
              <option key={member.id} value={member.id}>
                {member.id === me.id ? `${member.displayName} (אני)` : member.displayName}
              </option>
            ))}
          </select>
        </label>
        <label className="grid gap-1 text-xs font-light text-muted-foreground">
          למי
          <select value={toId} onChange={(event) => setToId(event.target.value)} className={selectClass}>
            {toChoices.map((member) => (
              <option key={member.id} value={member.id}>
                {member.id === me.id ? `${member.displayName} (אני)` : member.displayName}
              </option>
            ))}
          </select>
        </label>
        <label className="grid gap-1 text-xs font-light text-muted-foreground">
          סכום בשקלים
          <Input
            value={amount}
            onChange={(event) => setAmount(event.target.value)}
            placeholder="₪"
            inputMode="decimal"
            dir="ltr"
            className="text-end"
            required
          />
        </label>
        <GatheringSelect gatherings={gatherings} value={eventId} onChange={setEventId} />
      </div>
      <div className="grid gap-1 text-xs font-light text-muted-foreground">
        איך שילמת
        <div role="radiogroup" aria-label="איך שולם" className="flex gap-2">
          {PAYMENT_METHODS.map((option) => (
            <button
              key={option.id}
              type="button"
              role="radio"
              aria-checked={method === option.id}
              onClick={() => setMethod(method === option.id ? "" : option.id)}
              className={cn(
                "rounded-full border px-4 py-1.5 text-[13px] transition-colors",
                method === option.id
                  ? "border-[#a9782c] bg-[#f5f0e7] text-[#7d5a22]"
                  : "border-[#dfe3e8] text-foreground/75 hover:text-foreground"
              )}
            >
              {option.label}
            </button>
          ))}
        </div>
      </div>
      <Input
        value={note}
        onChange={(event) => setNote(event.target.value)}
        placeholder="הערה (לא חובה), למשל מספר אסמכתא"
        maxLength={200}
      />
      <div className="flex gap-2">
        <Button type="submit" className="rounded-full" disabled={saving || !toId}>
          {payment ? "שמירה" : "שמירת התשלום"}
        </Button>
        <Button type="button" variant="ghost" className="rounded-full" onClick={onDone}>
          ביטול
        </Button>
      </div>
    </form>
  );
}

function GatheringSelect({
  gatherings,
  value,
  onChange,
}: {
  gatherings: Gathering[];
  value: string;
  onChange: (value: string) => void;
}) {
  return (
    <label className="grid gap-1 text-xs font-light text-muted-foreground">
      לאיזו חברה
      <select value={value} onChange={(event) => onChange(event.target.value)} className={selectClass}>
        <option value="">בלי חברה מסוימת</option>
        {gatherings.map((event) => (
          <option key={event.id} value={event.id}>
            {gatheringLabel(event)} · {formatDateShortHe(event.startsAt)}
          </option>
        ))}
      </select>
    </label>
  );
}

function ExpenseForm({
  members,
  gatherings,
  expense,
  initial,
  onDone,
}: {
  members: Member[];
  gatherings: Gathering[];
  expense?: Expense;
  initial: Partial<Expense>;
  onDone?: () => void;
}) {
  const { act } = useApp();
  const [memberId, setMemberId] = useState(initial.memberId ?? members[0]?.id ?? "");
  const [title, setTitle] = useState(initial.title ?? "");
  const [amount, setAmount] = useState(initial.amount ? String(initial.amount) : "");
  const [detail, setDetail] = useState(initial.detail ?? "");
  const [excluded, setExcluded] = useState(Boolean(initial.excluded));
  const [eventId, setEventId] = useState(initial.eventId ?? "");
  const [saving, setSaving] = useState(false);

  return (
    <form
      className="space-y-3 rounded-[20px] border border-dashed border-[#d0d5dc] bg-white px-4 py-4"
      onSubmit={async (event) => {
        event.preventDefault();
        if (saving) return;
        setSaving(true);
        try {
          const fields = { memberId, title, detail, amount: Number(amount), excluded, eventId: eventId || null };
          if (expense) {
            await act({ type: "updateExpense", expenseId: expense.id, patch: fields });
            toast.success("ההוצאה עודכנה");
            onDone?.();
          } else {
            await act({ type: "addExpense", ...fields });
            setTitle("");
            setAmount("");
            setDetail("");
            setExcluded(false);
            toast.success("ההוצאה נוספה");
          }
        } catch (error) {
          fail(expense ? "השמירה נכשלה" : "ההוספה נכשלה")(error);
        } finally {
          setSaving(false);
        }
      }}
    >
      <div className="grid gap-2 sm:grid-cols-[minmax(0,1fr)_8.5rem]">
        <label className="grid gap-1 text-xs font-light text-muted-foreground">
          מה נקנה
          <Input
            value={title}
            onChange={(event) => setTitle(event.target.value)}
            placeholder="למשל: כיבוד, שתייה, ספרים"
            maxLength={80}
            required
          />
        </label>
        <label className="grid gap-1 text-xs font-light text-muted-foreground">
          כמה עלה, בשקלים
          <Input
            value={amount}
            onChange={(event) => setAmount(event.target.value)}
            placeholder="₪"
            inputMode="decimal"
            dir="ltr"
            className="text-end"
            required
          />
        </label>
      </div>
      <Textarea
        value={detail}
        onChange={(event) => setDetail(event.target.value)}
        placeholder="פרטים נוספים (לא חובה), למשל איפה נקנה"
        rows={2}
        maxLength={400}
      />
      <div className="grid gap-2 sm:grid-cols-2">
        <label className="grid gap-1 text-xs font-light text-muted-foreground">
          מי קנה
          <select value={memberId} onChange={(event) => setMemberId(event.target.value)} className={selectClass}>
            {members.map((member) => (
              <option key={member.id} value={member.id}>
                {member.displayName}
              </option>
            ))}
          </select>
        </label>
        <GatheringSelect gatherings={gatherings} value={eventId} onChange={setEventId} />
      </div>
      <label className="flex items-center gap-2 text-sm font-light text-foreground">
        <Switch checked={excluded} onCheckedChange={setExcluded} />
        לרשום בלי לחלק בין החברים
      </label>
      <div className="flex gap-2">
        <Button type="submit" className="rounded-full" disabled={saving}>
          {saving ? "שומר…" : expense ? "שמירה" : "רישום הקנייה"}
        </Button>
        {onDone ? (
          <Button type="button" variant="ghost" className="rounded-full" onClick={onDone}>
            ביטול
          </Button>
        ) : null}
      </div>
    </form>
  );
}
