"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { ArrowLeft, Pencil, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { useApp } from "@/components/app-provider";
import { BankAccounts, BankLines } from "@/components/bank-accounts";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import {
  SCOPE_ALL,
  SCOPE_NONE,
  canEditExpense,
  canEditPayment,
  expensesOpen,
  formatAgorot,
  formatShekels,
  scopedSettlement,
  type ExpenseScope,
  type Transfer,
} from "@/lib/expenses";
import { formatDateShortHe, gatheringLabel, memberById } from "@/lib/format";
import { isAdmin } from "@/lib/permissions";
import { upcomingGathering } from "@/lib/selectors";
import type { BankAccount, Expense, ExpensePayment, Gathering, Member } from "@/lib/types";
import { cn } from "@/lib/utils";

const panel = "rounded-[20px] border border-[#d5dbe3] bg-[#fbfcfd]";
const selectClass =
  "h-8 w-full rounded-[10px] border border-input bg-transparent px-2.5 text-sm text-foreground";

function fail(fallback: string) {
  return (error: unknown) => toast.error(error instanceof Error ? error.message : fallback);
}

function eventName(gatherings: Gathering[], id?: string) {
  if (!id) return null;
  const event = gatherings.find((item) => item.id === id);
  return event ? `${gatheringLabel(event)} · ${formatDateShortHe(event.startsAt)}` : null;
}

export function ExpensesView() {
  const { state, me, act } = useApp();
  const router = useRouter();
  const hidden = Boolean(state && !expensesOpen(state));
  const [picked, setPicked] = useState<ExpenseScope>(SCOPE_ALL);

  useEffect(() => {
    if (hidden) router.replace("/");
  }, [hidden, router]);

  if (!state || !me || hidden) return null;

  const admin = isAdmin(me);
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

  return (
    <div className="mx-auto flex max-w-5xl flex-col gap-6 md:gap-8">
      <header>
        <p className="text-[13px] font-light text-muted-foreground">כל חבר רושם מה שקנה ומה ששילם</p>
        <h1 className="mt-1 text-[1.65rem] font-medium tracking-tight md:text-[2rem]">באו חשבון</h1>
        <p className="mt-2 max-w-2xl text-sm font-light leading-6 text-muted-foreground">
          הסכום שנכנס לחשבון מתחלק שווה בשווה. מה שכל אחד קנה ומה שכבר העביר יורד מהחלק שלו. סכום מוחרג לא נכנס
          לחלוקה.
        </p>
      </header>

      <nav
        aria-label="שיוך לחברה"
        className="-mx-5 flex gap-2 overflow-x-auto px-5 pb-1 sm:mx-0 sm:flex-wrap sm:px-0"
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

      <div className="grid items-start gap-6 lg:grid-cols-[minmax(0,1.15fr)_minmax(0,0.85fr)] [&>*]:min-w-0">
        <div className="space-y-6">
          <section className="space-y-3">
            <h2 className="text-base font-medium">הוצאות</h2>
            {expenses.length === 0 ? (
              <p className={cn(panel, "px-5 py-8 text-sm font-light text-muted-foreground")}>
                {scope === SCOPE_ALL
                  ? "עדיין אין הוצאות. רושמים כאן מה נקנה, בכמה, ופירוט."
                  : "אין הוצאות משויכות לכאן."}
              </p>
            ) : (
              expenses.map((expense) => (
                <ExpenseRow
                  key={expense.id}
                  expense={expense}
                  members={state.members}
                  gatherings={gatherings}
                  showEvent={scope === SCOPE_ALL}
                  editable={canEditExpense(me, expense)}
                />
              ))
            )}
            <ExpenseForm
              key={`add-${defaultEventId ?? "none"}`}
              members={state.members}
              gatherings={gatherings}
              initial={{ memberId: me.id, eventId: defaultEventId }}
            />
          </section>

          <PaymentsPanel
            payments={payments}
            members={state.members}
            gatherings={gatherings}
            me={me}
            showEvent={scope === SCOPE_ALL}
            defaultEventId={defaultEventId}
          />
        </div>

        <div className="space-y-6">
          <section className={cn(panel, "space-y-3 p-4 md:p-5")}>
            <h2 className="text-base font-medium">החלוקה</h2>
            <div className="space-y-1 text-sm">
              <div className="flex justify-between gap-3">
                <span>נכנס לחשבון</span>
                <b className="font-medium">{formatAgorot(report.includedAgorot)}</b>
              </div>
              <div className="flex justify-between gap-3 text-muted-foreground">
                <span>מוחרג</span>
                <span>{formatAgorot(report.excludedAgorot)}</span>
              </div>
              <div className="flex justify-between gap-3">
                <span>{report.memberCount} חברים</span>
                <b className="font-medium">{formatAgorot(report.shareAgorot)} לחלק</b>
              </div>
              {report.paymentsAgorot > 0 ? (
                <div className="flex justify-between gap-3 text-muted-foreground">
                  <span>כבר הועבר</span>
                  <span>{formatAgorot(report.paymentsAgorot)}</span>
                </div>
              ) : null}
              {report.remainderAgorot > 0 ? (
                <p className="text-xs font-light text-muted-foreground">
                  נשארו {report.remainderAgorot} אגורות, והן נוספות לחלק של חלק מהחברים כדי שהחשבון ייסגר בדיוק.
                </p>
              ) : null}
            </div>
            <div className="divide-y divide-[#e9ecef]">
              {report.rows.map((row) => {
                const member = memberById(state.members, row.memberId);
                const owed = row.balanceAgorot > 0;
                const pays = row.owesAgorot > 0;
                const moved = [
                  `קנה ${formatAgorot(row.spentAgorot)}`,
                  row.paidAgorot ? `העביר ${formatAgorot(row.paidAgorot)}` : "",
                  row.receivedAgorot ? `קיבל ${formatAgorot(row.receivedAgorot)}` : "",
                ].filter(Boolean);
                return (
                  <div key={row.memberId} className="flex items-center justify-between gap-3 py-2.5">
                    <div className="min-w-0">
                      <div className="truncate text-sm">{member?.displayName ?? "חבר"}</div>
                      <div className="text-xs font-light text-muted-foreground">{moved.join(" · ")}</div>
                    </div>
                    <div className="flex shrink-0 items-center gap-2">
                      {owed ? (
                        <span className="rounded-full bg-[#f8edd9] px-2 py-0.5 text-[11px] text-[#8d6424]">
                          מגיע לו {formatAgorot(row.balanceAgorot)}
                        </span>
                      ) : pays ? (
                        <span className="rounded-full bg-[#f8e7e4] px-2 py-0.5 text-[11px] text-[#8d3a32]">
                          לשלם {formatAgorot(row.owesAgorot)}
                        </span>
                      ) : (
                        <span className="text-xs text-muted-foreground">מאוזן</span>
                      )}
                      {admin && pays && row.memberId !== me.id ? (
                        <Button
                          size="sm"
                          className="rounded-full"
                          onClick={() =>
                            void act({ type: "sendExpenseNotice", memberId: row.memberId, scope })
                              .then(() => toast.success(`נשלח ל${member?.displayName ?? "חבר"}`))
                              .catch(fail("השליחה נכשלה"))
                          }
                        >
                          שלח
                        </Button>
                      ) : null}
                    </div>
                  </div>
                );
              })}
            </div>
            {admin ? (
              <Button
                className="w-full rounded-full"
                onClick={() =>
                  void act({ type: "sendExpenseNotice", scope })
                    .then(() => toast.success("נשלח לכל מי שצריך לשלם"))
                    .catch(fail("השליחה נכשלה"))
                }
              >
                שליחה אישית לכל מי שצריך לשלם
              </Button>
            ) : null}
            <p className="text-xs font-light leading-5 text-muted-foreground">
              {admin
                ? "רק מנהל המערכת שולח. לכל מי שחייב נשלחת הודעה אישית עם הסכום, למי להעביר, והפירוט."
                : "החלק שווה לכולם. מה שכל אחד קנה ומה שכבר העביר יורד מהחלק שלו."}
            </p>
          </section>

          <TransfersPanel
            transfers={transfers}
            members={state.members}
            accounts={accounts}
            me={me}
            eventId={scopeEventId}
          />
        </div>
      </div>

      <BankAccounts members={state.members} accounts={accounts} me={me} />
    </div>
  );
}

function TransfersPanel({
  transfers,
  members,
  accounts,
  me,
  eventId,
}: {
  transfers: Transfer[];
  members: Member[];
  accounts: Record<string, BankAccount>;
  me: Member;
  eventId?: string;
}) {
  const { act } = useApp();
  const admin = isAdmin(me);
  const [busy, setBusy] = useState<string | null>(null);
  const mine = transfers.filter((item) => item.fromId === me.id || item.toId === me.id);
  const list = admin ? transfers : mine;

  return (
    <section className={cn(panel, "p-4 md:p-5")}>
      <h2 className="text-base font-medium">{admin ? "מי מעביר למי" : "ההעברות שלי"}</h2>
      {list.length === 0 ? (
        <p className="mt-2 text-sm font-light text-muted-foreground">
          {transfers.length ? "אין לך העברות פתוחות." : "החשבון סגור, אין העברות פתוחות."}
        </p>
      ) : (
        <div className="mt-2 divide-y divide-[#e9ecef]">
          {list.map((item) => {
            const key = `${item.fromId}-${item.toId}`;
            const from = memberById(members, item.fromId)?.displayName ?? "חבר";
            const to = memberById(members, item.toId)?.displayName ?? "חבר";
            const account = accounts[item.toId];
            const iPay = item.fromId === me.id;
            const canMark = iPay || item.toId === me.id || admin;
            return (
              <div key={key} className="py-3">
                <div className="flex items-center justify-between gap-3">
                  <div className="flex min-w-0 items-center gap-1.5 text-sm">
                    <span className="truncate">{iPay ? "אני" : from}</span>
                    <ArrowLeft className="size-3.5 shrink-0 text-[#9aa1ab]" />
                    <span className="truncate">{item.toId === me.id ? "אני" : to}</span>
                  </div>
                  <b className="shrink-0 text-sm font-medium">{formatAgorot(item.amountAgorot)}</b>
                </div>
                {iPay ? (
                  account ? (
                    <div className="mt-1.5 rounded-[12px] bg-[#f3f5f7] px-3 py-2">
                      <BankLines account={account} compact />
                    </div>
                  ) : (
                    <p className="mt-1 text-xs font-light text-[#9aa1ab]">{to} עדיין לא מילא פרטי חשבון</p>
                  )
                ) : null}
                {canMark ? (
                  <Button
                    size="sm"
                    variant="outline"
                    className="mt-2 rounded-full"
                    disabled={busy === key}
                    onClick={async () => {
                      setBusy(key);
                      try {
                        await act({
                          type: "addPayment",
                          fromId: item.fromId,
                          toId: item.toId,
                          amount: item.amountAgorot / 100,
                          eventId: eventId ?? null,
                        });
                        toast.success("התשלום סומן");
                      } catch (error) {
                        fail("הסימון נכשל")(error);
                      } finally {
                        setBusy(null);
                      }
                    }}
                  >
                    {iPay ? "סימנתי ששילמתי" : item.toId === me.id ? "קיבלתי" : "סימון כשולם"}
                  </Button>
                ) : null}
              </div>
            );
          })}
        </div>
      )}
    </section>
  );
}

function PaymentsPanel({
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
  const [editing, setEditing] = useState<string | null>(null);
  const [adding, setAdding] = useState(false);
  const sorted = [...payments].sort((a, b) => b.createdAt.localeCompare(a.createdAt));

  return (
    <section className="space-y-3">
      <div className="flex items-center justify-between gap-3">
        <h2 className="text-base font-medium">תשלומים שסומנו</h2>
        {!adding ? (
          <Button size="sm" variant="outline" className="rounded-full" onClick={() => setAdding(true)}>
            סימון תשלום
          </Button>
        ) : null}
      </div>
      {adding ? (
        <PaymentForm
          members={members}
          gatherings={gatherings}
          me={me}
          initial={{ fromId: me.id, eventId: defaultEventId }}
          onDone={() => setAdding(false)}
        />
      ) : null}
      {sorted.length === 0 && !adding ? (
        <p className={cn(panel, "px-5 py-6 text-sm font-light text-muted-foreground")}>
          עוד לא סומנו תשלומים. מי שהעביר כסף מסמן כאן למי וכמה.
        </p>
      ) : null}
      {sorted.map((payment) => {
        if (editing === payment.id) {
          return (
            <PaymentForm
              key={payment.id}
              members={members}
              gatherings={gatherings}
              me={me}
              payment={payment}
              initial={payment}
              onDone={() => setEditing(null)}
            />
          );
        }
        const from = memberById(members, payment.fromId)?.displayName ?? "חבר";
        const to = memberById(members, payment.toId)?.displayName ?? "חבר";
        const where = showEvent ? eventName(gatherings, payment.eventId) : null;
        const meta = [formatDateShortHe(payment.createdAt), where, payment.note.trim()].filter(Boolean);
        return (
          <article key={payment.id} className={cn(panel, "rounded-[16px] px-4 py-3")}>
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <div className="text-sm">
                  {from} שילם ל{to}
                </div>
                <div className="mt-0.5 text-xs font-light text-muted-foreground">{meta.join(" · ")}</div>
              </div>
              <div className="shrink-0 text-sm text-[#3d8f62]">{formatShekels(payment.amount)}</div>
            </div>
            {canEditPayment(me, payment) ? (
              <div className="mt-2 flex flex-wrap gap-2">
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
              </div>
            ) : null}
          </article>
        );
      })}
    </section>
  );
}

function PaymentForm({
  members,
  gatherings,
  me,
  payment,
  initial,
  onDone,
}: {
  members: Member[];
  gatherings: Gathering[];
  me: Member;
  payment?: ExpensePayment;
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
          const fields = { fromId, toId, amount: Number(amount), eventId: eventId || null, note };
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
      <Input value={note} onChange={(event) => setNote(event.target.value)} placeholder="הערה, למשל בביט" maxLength={200} />
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

function ExpenseRow({
  expense,
  members,
  gatherings,
  showEvent,
  editable,
}: {
  expense: Expense;
  members: Member[];
  gatherings: Gathering[];
  showEvent: boolean;
  editable: boolean;
}) {
  const { act } = useApp();
  const [editing, setEditing] = useState(false);
  const buyer = memberById(members, expense.memberId);
  const where = showEvent ? eventName(gatherings, expense.eventId) : null;

  if (editing) {
    return (
      <ExpenseForm
        members={members}
        gatherings={gatherings}
        expense={expense}
        initial={expense}
        onDone={() => setEditing(false)}
      />
    );
  }

  return (
    <article className={cn(panel, "rounded-[16px] px-4 py-3")}>
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <div className={cn("text-sm", expense.excluded && "text-muted-foreground line-through")}>
            {expense.title}
          </div>
          <div className="mt-0.5 text-xs font-light text-muted-foreground">
            {[buyer?.displayName ?? "חבר", expense.detail.trim(), where].filter(Boolean).join(" · ")}
          </div>
        </div>
        <div className={cn("shrink-0 text-sm", expense.excluded && "text-muted-foreground line-through")}>
          {formatShekels(expense.amount)}
        </div>
      </div>
      {expense.excluded ? (
        <div className="mt-2 inline-flex rounded-full bg-[#f8e7e4] px-2 py-0.5 text-[11px] text-[#8d3a32]">
          מוחרג מהחשבון
        </div>
      ) : null}
      {editable ? (
        <div className="mt-2 flex flex-wrap gap-2">
          <Button variant="outline" size="sm" className="rounded-full" onClick={() => setEditing(true)}>
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
            {expense.excluded ? "להחזיר לחשבון" : "החרגה"}
          </Button>
          <Button
            variant="ghost"
            size="sm"
            className="rounded-full"
            onClick={() => void act({ type: "deleteExpense", expenseId: expense.id }).catch(fail("המחיקה נכשלה"))}
          >
            <Trash2 data-icon="inline-start" />
            מחיקה
          </Button>
        </div>
      ) : null}
    </article>
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
        {expense ? (
          <Button type="button" variant="ghost" className="rounded-full" onClick={onDone}>
            ביטול
          </Button>
        ) : null}
      </div>
    </form>
  );
}
