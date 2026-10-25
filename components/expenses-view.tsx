"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { ArrowLeft, Check, Copy, FileSpreadsheet, FileText, Pencil, Plus, Trash2 } from "lucide-react";
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
  expenseScopeLabel,
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
    { id: SCOPE_ALL, label: "הכל" },
    ...scopeEvents.map((event) => ({
      id: event.id,
      label: `${gatheringLabel(event)} · ${formatDateShortHe(event.startsAt)}`,
    })),
    ...(hasUnassigned ? [{ id: SCOPE_NONE, label: "ללא שיוך" }] : []),
  ];
  const tabs: { id: Tab; label: string; count?: number }[] = [
    { id: "expenses", label: "הוצאות", count: expenses.length },
    { id: "payments", label: "תשלומים", count: payments.length },
    { id: "members", label: "כולם" },
    { id: "bank", label: "פרטי בנק" },
  ];

  return (
    <div className="flex flex-col">
      <header className="flex items-end justify-between gap-4">
        <div className="min-w-0">
          <p className="truncate text-[13px] font-light text-muted-foreground">{expenseScopeLabel(state, scope)}</p>
          <h1 className="mt-0.5 text-[1.75rem] font-medium leading-tight tracking-tight md:text-[2.1rem]">
            באו חשבון
          </h1>
        </div>
        <div className="flex shrink-0 gap-2">
          <a href={`/api/expenses/export?scope=${encodeURIComponent(scope)}`} download className={exportLink}>
            <FileSpreadsheet className="size-4 text-[#3d8f62]" />
            אקסל
          </a>
          <a
            href={`/print/expenses?scope=${encodeURIComponent(scope)}`}
            target="_blank"
            rel="noopener"
            className={exportLink}
          >
            <FileText className="size-4 text-[#a4453a]" />
            PDF
          </a>
        </div>
      </header>

      <nav
        aria-label="שיוך לחברה"
        className="-mx-5 mt-4 flex gap-2 overflow-x-auto px-5 pb-1 sm:mx-0 sm:flex-wrap sm:px-0"
      >
        {chips.map((chip) => (
          <button
            key={chip.id}
            type="button"
            onClick={() => setPicked(chip.id)}
            className={cn(
              "shrink-0 rounded-full border px-3.5 py-1.5 text-[13px] transition-colors",
              scope === chip.id
                ? "border-[#a9782c] bg-[#f5f0e7] text-[#7d5a22]"
                : "border-[#dfe3e8] text-foreground/75 hover:text-foreground"
            )}
          >
            {chip.label}
          </button>
        ))}
      </nav>

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

      {gatherings.length ? (
        <div className="mt-4">
          <GatheringExempt
            key={scopeEventId ?? "all"}
            gatherings={gatherings}
            members={state.members}
            waivers={state.expenseWaivers ?? []}
            admin={isAdmin(me)}
            initialEventId={scopeEventId}
          />
        </div>
      ) : null}

      <div
        role="tablist"
        className="-mx-5 mt-7 flex gap-6 overflow-x-auto border-b border-[#e3e7ec] px-5 sm:mx-0 sm:px-0"
      >
        {tabs.map((item) => (
          <button
            key={item.id}
            type="button"
            role="tab"
            aria-selected={tab === item.id}
            onClick={() => setTab(item.id)}
            className={cn(
              "-mb-px shrink-0 border-b-2 pb-2.5 text-[15px] transition-colors",
              tab === item.id
                ? "border-[#a9782c] text-foreground"
                : "border-transparent text-muted-foreground hover:text-foreground"
            )}
          >
            {item.label}
            {item.count ? <span className="ms-1.5 text-[#9aa1ab]">{item.count}</span> : null}
          </button>
        ))}
      </div>

      <div className="mt-4">
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
            <p className="mt-3 text-xs font-light text-[#9aa1ab]">
              {[
                `${formatAgorot(report.includedAgorot)} בחשבון`,
                `${report.memberCount} חברים`,
                report.sharesEqual ? `${formatAgorot(report.shareAgorot)} לכל אחד` : "מי שמוחרג לא משלם, והשאר כמו קודם",
                report.waivedAgorot ? `${formatAgorot(report.waivedAgorot)} ירד בהחרגה` : "",
                report.excludedAgorot ? `${formatAgorot(report.excludedAgorot)} מוחרג` : "",
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

  const facts = row
    ? [
        `החלק שלך ${formatAgorot(row.shareAgorot)}`,
        `קנית ${formatAgorot(row.spentAgorot)}`,
        row.paidAgorot ? `העברת ${formatAgorot(row.paidAgorot)}` : "",
        row.receivedAgorot ? `קיבלת ${formatAgorot(row.receivedAgorot)}` : "",
      ].filter(Boolean)
    : [];

  const headline = !row
    ? { amount: null, text: "אין חשבון להצגה" }
    : row.owesAgorot > 0
      ? {
          amount: row.owesAgorot,
          text: toPay.length === 1 ? `להעביר ל${name(toPay[0].toId)}` : `להעביר ל־${toPay.length} חברים`,
        }
      : row.balanceAgorot > 0
        ? { amount: row.balanceAgorot, text: "מגיע לך" }
        : { amount: null, text: "הכל מאוזן, אין לך מה להעביר" };

  const form = (item: Transfer, method: PaymentMethod) => (
    <div className="mt-3">
      <PaymentForm
        members={members}
        gatherings={gatherings}
        me={me}
        title="למי שולם ואיך"
        initial={{ fromId: item.fromId, toId: item.toId, amount: item.amountAgorot / 100, eventId, method }}
        onDone={() => setOpen(null)}
      />
    </div>
  );

  return (
    <section className="mt-5 rounded-[24px] bg-[#1f2328] p-5 text-white md:p-7">
      <div className="text-[13px] font-light text-white/60">המצב שלך, {firstName}</div>
      <div className="mt-1">
        {headline.amount !== null ? (
          <div className="text-[2.2rem] leading-none tabular-nums md:text-[2.75rem]">
            {formatAgorot(headline.amount)}
          </div>
        ) : null}
        <div
          className={cn(
            "font-light text-white/80",
            headline.amount !== null ? "mt-2 text-[14px]" : "text-[1.35rem] text-white"
          )}
        >
          {headline.text}
          {facts.map((fact, index) => (
            <span key={fact} className="text-white/55">
              {index === 0 ? " · " : ", "}
              <span className="whitespace-nowrap">{fact}</span>
            </span>
          ))}
        </div>
      </div>

      {toPay.map((item) => {
        const key = `${item.fromId}-${item.toId}`;
        const account = accounts[item.toId];
        return (
          <div key={key} className="mt-5 rounded-[16px] bg-white/[.06] p-4">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div className="flex min-w-0 items-center gap-2.5">
                <UserAvatar member={memberById(members, item.toId)} size="sm" />
                <div className="min-w-0">
                  <div className="truncate text-[15px]">{name(item.toId)}</div>
                  <div className="text-[13px] tabular-nums text-white/60">{formatAgorot(item.amountAgorot)}</div>
                </div>
              </div>
              {open?.key !== key ? (
                <div className="flex gap-2">
                  <button
                    type="button"
                    onClick={() => setOpen({ key, method: "transfer" })}
                    className="rounded-full bg-[#c9a15a] px-4 py-2 text-[13px] text-[#1f2328] hover:bg-[#d4ae6a]"
                  >
                    שילמתי בהעברה
                  </button>
                  <button
                    type="button"
                    onClick={() => setOpen({ key, method: "cash" })}
                    className="rounded-full border border-white/25 px-4 py-2 text-[13px] text-white hover:bg-white/10"
                  >
                    שילמתי במזומן
                  </button>
                </div>
              ) : null}
            </div>
            {account ? (
              <DarkBank account={account} />
            ) : (
              <p className="mt-3 text-[13px] font-light text-white/50">
                {name(item.toId)} עדיין לא מילא פרטי חשבון. אפשר לשלם במזומן או לבקש ממנו.
              </p>
            )}
            {open?.key === key ? form(item, open.method) : null}
          </div>
        );
      })}

      {toGet.length ? (
        <div className="mt-5 divide-y divide-white/10 rounded-[16px] bg-white/[.06] px-4">
          {toGet.map((item) => {
            const key = `${item.fromId}-${item.toId}`;
            return (
              <div key={key} className="py-3">
                <div className="flex items-center justify-between gap-3">
                  <div className="flex min-w-0 items-center gap-2.5">
                    <UserAvatar member={memberById(members, item.fromId)} size="sm" />
                    <div className="min-w-0">
                      <div className="truncate text-[14px]">{name(item.fromId)}</div>
                      <div className="text-[12px] font-light text-white/55">יעביר לך</div>
                    </div>
                  </div>
                  <div className="flex shrink-0 items-center gap-3">
                    <span className="text-[14px] tabular-nums">{formatAgorot(item.amountAgorot)}</span>
                    {open?.key !== key ? (
                      <button
                        type="button"
                        onClick={() => setOpen({ key, method: "transfer" })}
                        className="rounded-full border border-white/25 px-3 py-1 text-[12px] hover:bg-white/10"
                      >
                        קיבלתי
                      </button>
                    ) : null}
                  </div>
                </div>
                {open?.key === key ? form(item, open.method) : null}
              </div>
            );
          })}
        </div>
      ) : null}

      {totalFlow > 0 ? (
        <div className="mt-5">
          <div className="flex justify-between text-[12px] font-light text-white/60">
            <span>החשבון נסגר</span>
            <span className="tabular-nums">
              {formatAgorot(report.paymentsAgorot)} מתוך {formatAgorot(totalFlow)}
            </span>
          </div>
          <div className="mt-1.5 h-1.5 overflow-hidden rounded-full bg-white/10">
            <div
              className="h-full rounded-full bg-[#c9a15a]"
              style={{ width: `${Math.max(3, Math.round((report.paymentsAgorot / totalFlow) * 100))}%` }}
            />
          </div>
        </div>
      ) : null}

      {admin ? (
        <div className="mt-5 flex flex-wrap items-center justify-between gap-3 border-t border-white/10 pt-4">
          <span className="text-[13px] font-light text-white/70">
            {debtors ? `${debtors} חייבים · ${formatAgorot(openAgorot)} פתוח` : "אין חייבים פתוחים"}
          </span>
          {debtors ? (
            <button
              type="button"
              disabled={sending}
              onClick={() => {
                if (busy.current) return;
                busy.current = true;
                setSending(true);
                void act({ type: "sendExpenseNotice", scope })
                  .then(noticeSent("נשלח לכל מי שצריך לשלם"))
                  .catch(fail("השליחה נכשלה"))
                  .finally(() => {
                    busy.current = false;
                    setSending(false);
                  });
              }}
              className="rounded-full border border-white/25 px-4 py-1.5 text-[13px] hover:bg-white/10 disabled:opacity-60"
            >
              {sending ? "שולח…" : "שליחה אישית לכל החייבים"}
            </button>
          ) : null}
        </div>
      ) : null}
    </section>
  );
}

function DarkBank({ account }: { account: BankAccount }) {
  const bankLine = [account.holder, account.bank, account.branch ? `סניף ${account.branch}` : ""]
    .filter(Boolean)
    .join(" · ");
  return (
    <div className="mt-3 grid gap-3 md:grid-cols-[minmax(0,1fr)_auto] md:items-center">
      <div className="min-w-0 text-[13px] font-light leading-6 text-white/75">
        {bankLine ? <div className="truncate">{bankLine}</div> : null}
        <div className="flex flex-wrap items-baseline gap-x-2">
          {account.account ? (
            <span dir="ltr" className="text-[16px] text-white tabular-nums">
              {account.account}
            </span>
          ) : null}
          {account.phone ? (
            <span>
              ביט / פייבוקס{" "}
              <span dir="ltr" className="text-white tabular-nums">
                {account.phone}
              </span>
            </span>
          ) : null}
        </div>
        {account.note ? <div className="text-white/55">{account.note}</div> : null}
      </div>
      <div className="flex flex-wrap gap-2">
        {account.account ? <CopyPill label="העתקת חשבון" value={account.account} /> : null}
        {account.phone ? <CopyPill label="העתקת טלפון" value={account.phone} /> : null}
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
      className="inline-flex items-center gap-1.5 rounded-full border border-white/20 px-3 py-1.5 text-[12px] text-white/85 hover:bg-white/10"
    >
      {copied ? <Check className="size-3.5 text-[#8fd1a8]" /> : <Copy className="size-3.5" />}
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
  gatherings,
  members,
  waivers,
  admin,
  initialEventId,
}: {
  gatherings: Gathering[];
  members: Member[];
  waivers: GatheringWaiver[];
  admin: boolean;
  initialEventId?: string;
}) {
  const { act } = useApp();
  const [eventId, setEventId] = useState(initialEventId || gatherings[0]?.id || "");
  const [pending, setPending] = useState<string | null>(null);
  const selected = new Set(waivers.find((item) => item.eventId === eventId)?.memberIds ?? []);
  const everyone = members.length > 0 && members.every((member) => selected.has(member.id));
  if (!admin && selected.size === 0) return null;

  return (
    <section className={cn(panel, "px-4 py-3.5")}>
      <div className="text-[15px]">החרגה מחברה שלמה</div>
      <p className="mt-0.5 text-xs font-light text-muted-foreground">
        מי שמסומן לא משלם את החלק שלו על ההוצאות של החברה, גם על מה שיתווסף אחר כך. השאר משלמים כמו קודם.
      </p>
      <label className="mt-3 grid gap-1 text-xs font-light text-muted-foreground">
        איזו חברה
        <select value={eventId} onChange={(event) => setEventId(event.target.value)} className={selectClass}>
          {gatherings.map((event) => (
            <option key={event.id} value={event.id}>
              {gatheringLabel(event)} · {formatDateShortHe(event.startsAt)}
            </option>
          ))}
        </select>
      </label>
      <div className="mt-2.5">
        {admin ? (
          <>
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
            <button
              type="button"
              disabled={pending !== null}
              onClick={() => {
                setPending("*");
                void act({
                  type: "setGatheringExemptIds",
                  eventId,
                  memberIds: everyone ? [] : members.map((member) => member.id),
                })
                  .catch(fail("ההחרגה נכשלה"))
                  .finally(() => setPending(null));
              }}
              className="mt-2 text-[13px] text-[#a9782c] hover:underline disabled:opacity-60"
            >
              {everyone ? "החזר את כולם" : "החרג את כולם"}
            </button>
          </>
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
            title={held ? "מוחרג מכל החברה" : undefined}
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
          {showEvent ? "עדיין אין הוצאות. רושמים כאן מה נקנה, בכמה, ופירוט." : "אין הוצאות משויכות לכאן."}
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
          expense.excluded ? "מוחרג מהחשבון" : null,
          exemptNames.length ? `בלי ${exemptNames.join(", ")}` : null,
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
                  {expense.excluded ? "להחזיר לחשבון" : "החרגת הסכום"}
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
                    <div className="text-[13px]">החרג חבר</div>
                    <p className="mb-1.5 text-xs font-light text-muted-foreground">
                      מי שמסומן לא משלם על ההוצאה הזו. השאר משלמים את אותו חלק.
                    </p>
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
                    <button
                      type="button"
                      disabled={pending !== null}
                      onClick={() => {
                        const all = members.every((member) => (expense.exemptIds ?? []).includes(member.id));
                        setPending("*");
                        void act({
                          type: "setExpenseExemptIds",
                          expenseId: expense.id,
                          memberIds: all ? [] : members.map((member) => member.id),
                        })
                          .catch(fail("ההחרגה נכשלה"))
                          .finally(() => setPending(null));
                      }}
                      className="mt-2 text-[13px] text-[#a9782c] hover:underline disabled:opacity-60"
                    >
                      {members.every((member) => (expense.exemptIds ?? []).includes(member.id))
                        ? "החזר את כולם"
                        : "החרג את כולם"}
                    </button>
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
        <AddRow label="הוספת הוצאה" onClick={() => setAdding(true)} />
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
          עוד לא סומנו תשלומים. מי שהעביר כסף מסמן כאן למי, כמה ואיך.
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
        <AddRow label="סימון תשלום" onClick={() => setAdding(true)} />
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
            report.sharesEqual ? "" : `חלק ${formatAgorot(row.shareAgorot)}`,
            `קנה ${formatAgorot(row.spentAgorot)}`,
            row.absorbedAgorot ? `החרגה ${formatAgorot(row.absorbedAgorot)}` : "",
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
                  לשלם {formatAgorot(row.owesAgorot)}
                </span>
              ) : row.shareAgorot === 0 && report.includedAgorot > 0 && !report.sharesEqual ? (
                <span className="shrink-0 text-xs text-muted-foreground">לא בחשבון</span>
              ) : (
                <span className="shrink-0 text-xs text-muted-foreground">מאוזן</span>
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
                      .then(noticeSent(`נשלח ל${member?.displayName ?? "חבר"}`))
                      .catch(fail("השליחה נכשלה"))
                      .finally(() => {
                        busy.current = false;
                        setSending(null);
                      });
                  }}
                >
                  {sending === row.memberId ? "שולח…" : "שלח"}
                </Button>
              ) : null}
            </div>
          );
        })}
      </div>
      {report.remainderAgorot > 0 ? (
        <p className="text-xs font-light text-[#9aa1ab]">
          נשארו {report.remainderAgorot} אגורות, והן נוספות לחלק של חלק מהחברים כדי שהחשבון ייסגר בדיוק.
        </p>
      ) : null}

      {transfers.length ? (
        <section>
          <h2 className="mb-2 text-[15px] font-medium">מי מעביר למי</h2>
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
                          שולם
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
                        title="למי שולם ואיך"
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
        <p className="text-sm font-light text-muted-foreground">החשבון סגור, אין העברות פתוחות.</p>
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
          כמה
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
        איך שולם
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
        placeholder="הערה, למשל בביט או מספר אסמכתא"
        maxLength={200}
      />
      <div className="flex gap-2">
        <Button type="submit" className="rounded-full" disabled={saving || !toId}>
          {payment ? "שמירה" : "סימון"}
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
      שיוך לחברה
      <select value={value} onChange={(event) => onChange(event.target.value)} className={selectClass}>
        <option value="">ללא שיוך</option>
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
      <div className="grid gap-2 sm:grid-cols-[minmax(0,1fr)_7.5rem]">
        <Input
          value={title}
          onChange={(event) => setTitle(event.target.value)}
          placeholder="מה נקנה"
          maxLength={80}
          required
        />
        <Input
          value={amount}
          onChange={(event) => setAmount(event.target.value)}
          placeholder="₪"
          inputMode="decimal"
          dir="ltr"
          className="text-end"
          required
        />
      </div>
      <Textarea
        value={detail}
        onChange={(event) => setDetail(event.target.value)}
        placeholder="פירוט, איפה ומתי"
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
        להחריג את הסכום מהחשבון
      </label>
      <div className="flex gap-2">
        <Button type="submit" className="rounded-full" disabled={saving}>
          {saving ? "שומר…" : expense ? "שמירה" : "הוספה"}
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
