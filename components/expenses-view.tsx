"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Trash2 } from "lucide-react";
import { toast } from "sonner";
import { useApp } from "@/components/app-provider";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import {
  canEditExpense,
  expensesOpen,
  formatAgorot,
  formatShekels,
  settlement,
} from "@/lib/expenses";
import { gatheringLabel, memberById } from "@/lib/format";
import { upcomingGathering } from "@/lib/selectors";
import { cn } from "@/lib/utils";

export function ExpensesView() {
  const { state, me, act } = useApp();
  const router = useRouter();
  const hidden = Boolean(state && !expensesOpen(state));

  useEffect(() => {
    if (hidden) router.replace("/");
  }, [hidden, router]);

  if (!state || !me || hidden) return null;

  const event = upcomingGathering(state);
  const expenses = state.expenses ?? [];
  const report = settlement(
    expenses,
    state.members.map((member) => member.id)
  );

  return (
    <div className="mx-auto flex max-w-5xl flex-col gap-8">
      <header>
        <p className="text-[13px] font-light text-muted-foreground">
          {event ? gatheringLabel(event) : "כל חבר רושם מה שקנה"}
        </p>
        <h1 className="mt-1 text-[1.65rem] font-medium tracking-tight md:text-[2rem]">באו חשבון</h1>
        <p className="mt-2 max-w-2xl text-sm font-light leading-6 text-muted-foreground">
          הסכום שנכנס לחשבון מתחלק שווה בשווה. מה שכל אחד קנה יורד מהחלק שלו. סכום מוחרג לא נכנס לחלוקה.
        </p>
      </header>

      <div className="grid items-start gap-6 lg:grid-cols-[minmax(0,1.15fr)_minmax(0,0.85fr)]">
        <section className="space-y-3">
          {expenses.length === 0 ? (
            <p className="rounded-[1.75rem] border border-[#d5dbe3] bg-[#fbfcfd] px-5 py-8 text-sm font-light text-muted-foreground">
              עדיין אין הוצאות. רושמים כאן מה נקנה, בכמה, ופירוט.
            </p>
          ) : (
            expenses.map((expense) => {
              const buyer = memberById(state.members, expense.memberId);
              const editable = canEditExpense(me, expense);
              return (
                <article
                  key={expense.id}
                  className="rounded-[1.25rem] border border-[#d5dbe3] bg-[#fbfcfd] px-4 py-3"
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <div className={cn("text-sm", expense.excluded && "text-muted-foreground line-through")}>
                        {expense.title}
                      </div>
                      <div className="mt-0.5 text-xs font-light text-muted-foreground">
                        {buyer?.displayName ?? "חבר"}
                        {expense.detail.trim() ? ` · ${expense.detail.trim()}` : ""}
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
                      <Button
                        variant="outline"
                        size="sm"
                        className="rounded-full"
                        onClick={() =>
                          void act({
                            type: "setExpenseExcluded",
                            expenseId: expense.id,
                            excluded: !expense.excluded,
                          }).catch((error: unknown) =>
                            toast.error(error instanceof Error ? error.message : "העדכון נכשל")
                          )
                        }
                      >
                        {expense.excluded ? "להחזיר לחשבון" : "החרגה"}
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        className="rounded-full"
                        onClick={() =>
                          void act({ type: "deleteExpense", expenseId: expense.id }).catch((error: unknown) =>
                            toast.error(error instanceof Error ? error.message : "המחיקה נכשלה")
                          )
                        }
                      >
                        <Trash2 data-icon="inline-start" />
                        מחיקה
                      </Button>
                    </div>
                  ) : null}
                </article>
              );
            })
          )}
          <AddExpense members={state.members} meId={me.id} />
        </section>

        <section className="space-y-3 rounded-[1.75rem] border border-[#d5dbe3] bg-[#fbfcfd] p-4 md:p-5">
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
            {report.remainderAgorot > 0 ? (
              <p className="text-xs font-light text-muted-foreground">
                נשארו {report.remainderAgorot} אגורות, והן נוספות לחלק של חלק מהחברים כדי שהחשבון ייסגר בדיוק.
              </p>
            ) : null}
          </div>
          <div className="divide-y divide-[#e6ebf0]">
            {report.rows.map((row) => {
              const member = memberById(state.members, row.memberId);
              const owed = row.balanceAgorot > 0;
              const pays = row.owesAgorot > 0;
              return (
                <div key={row.memberId} className="flex items-center justify-between gap-3 py-2.5">
                  <div className="min-w-0">
                    <div className="truncate text-sm">{member?.displayName ?? "חבר"}</div>
                    <div className="text-xs font-light text-muted-foreground">
                      קנה {formatAgorot(row.spentAgorot)}
                    </div>
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
                    {pays && row.memberId !== me.id ? (
                      <Button
                        size="sm"
                        className="rounded-full"
                        onClick={() =>
                          void act({ type: "sendExpenseNotice", memberId: row.memberId })
                            .then(() => toast.success(`נשלח ל${member?.displayName ?? "חבר"}`))
                            .catch((error: unknown) =>
                              toast.error(error instanceof Error ? error.message : "השליחה נכשלה")
                            )
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
          <Button
            className="w-full rounded-full"
            onClick={() =>
              void act({ type: "sendExpenseNotice" })
                .then(() => toast.success("נשלח לכל מי שצריך לשלם"))
                .catch((error: unknown) => toast.error(error instanceof Error ? error.message : "השליחה נכשלה"))
            }
          >
            שליחה אישית לכל מי שצריך לשלם
          </Button>
          <p className="text-xs font-light leading-5 text-muted-foreground">
            לכל מי שחייב נשלחת הודעה אישית עם הסכום והפירוט. מי שכבר הוציא יותר מהחלק שלו לא מקבל בקשת תשלום.
          </p>
        </section>
      </div>
    </div>
  );
}

function AddExpense({
  members,
  meId,
}: {
  members: { id: string; displayName: string }[];
  meId: string;
}) {
  const { act } = useApp();
  const [memberId, setMemberId] = useState(meId);
  const [title, setTitle] = useState("");
  const [amount, setAmount] = useState("");
  const [detail, setDetail] = useState("");
  const [excluded, setExcluded] = useState(false);
  const [saving, setSaving] = useState(false);

  return (
    <form
      className="space-y-3 rounded-[1.75rem] border border-dashed border-[#d0d5dc] bg-white px-4 py-4"
      onSubmit={async (event) => {
        event.preventDefault();
        if (saving) return;
        setSaving(true);
        try {
          await act({
            type: "addExpense",
            memberId,
            title,
            detail,
            amount: Number(amount),
            excluded,
          });
          setTitle("");
          setAmount("");
          setDetail("");
          setExcluded(false);
          toast.success("ההוצאה נוספה");
        } catch (error) {
          toast.error(error instanceof Error ? error.message : "ההוספה נכשלה");
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
      <label className="grid gap-1 text-xs font-light text-muted-foreground">
        מי קנה
        <select
          value={memberId}
          onChange={(event) => setMemberId(event.target.value)}
          className="h-8 rounded-lg border border-input bg-transparent px-2.5 text-sm text-foreground"
        >
          {members.map((member) => (
            <option key={member.id} value={member.id}>
              {member.displayName}
            </option>
          ))}
        </select>
      </label>
      <label className="flex items-center gap-2 text-sm font-light text-foreground">
        <Switch checked={excluded} onCheckedChange={setExcluded} />
        להחריג את הסכום מהחשבון
      </label>
      <Button type="submit" className="rounded-full" disabled={saving}>
        {saving ? "מוסיף…" : "הוספה"}
      </Button>
    </form>
  );
}
