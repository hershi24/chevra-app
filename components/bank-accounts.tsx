"use client";

import { useState } from "react";
import { Check, Copy, Pencil } from "lucide-react";
import { toast } from "sonner";
import { useApp } from "@/components/app-provider";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { isAdmin } from "@/lib/permissions";
import type { BankAccount, Member } from "@/lib/types";
import { cn } from "@/lib/utils";

type Draft = Omit<BankAccount, "updatedAt">;

const EMPTY: Draft = { holder: "", bank: "", branch: "", account: "", phone: "", note: "" };

export function BankAccounts({
  members,
  accounts,
  me,
}: {
  members: Member[];
  accounts: Record<string, BankAccount>;
  me: Member;
}) {
  const admin = isAdmin(me);
  const [editing, setEditing] = useState<string | null>(null);
  const ordered = [...members].sort((a, b) => {
    if (a.id === me.id) return -1;
    if (b.id === me.id) return 1;
    const has = Number(Boolean(accounts[b.id])) - Number(Boolean(accounts[a.id]));
    return has || a.displayName.localeCompare(b.displayName, "he");
  });
  const visible = ordered.filter((member) => member.id === me.id || admin || accounts[member.id]);

  return (
    <section className="rounded-[20px] border border-[#d5dbe3] bg-[#fbfcfd] p-4 md:p-5">
      <h2 className="text-base font-medium">פרטי חשבון להעברה</h2>
      <p className="mt-1 text-xs font-light leading-5 text-muted-foreground">
        כל אחד ממלא את הפרטים שלו, וכולם רואים אותם כדי להעביר. {admin ? "כמנהל אפשר לערוך לכל חבר." : ""}
      </p>
      <div className="mt-3 grid divide-y divide-[#e9ecef] md:grid-cols-2 md:gap-x-8 md:divide-y-0 [&>*]:border-[#e9ecef] md:[&>*]:border-b">
        {visible.map((member) => {
          const account = accounts[member.id];
          const canEdit = admin || member.id === me.id;
          if (editing === member.id) {
            return (
              <BankForm
                key={member.id}
                member={member}
                initial={account}
                onDone={() => setEditing(null)}
              />
            );
          }
          return (
            <div key={member.id} className="flex items-start justify-between gap-3 py-3">
              <div className="min-w-0">
                <div className="text-sm">
                  {member.displayName}
                  {member.id === me.id ? <span className="text-muted-foreground"> · אני</span> : null}
                </div>
                {account ? (
                  <BankLines account={account} />
                ) : (
                  <div className="mt-0.5 text-xs font-light text-[#9aa1ab]">עדיין לא מילא פרטים</div>
                )}
              </div>
              {canEdit ? (
                <button
                  type="button"
                  onClick={() => setEditing(member.id)}
                  className="inline-flex shrink-0 items-center gap-1 rounded-full border border-[#dfe3e8] px-3 py-1 text-[12px] text-foreground/75 hover:text-foreground"
                >
                  <Pencil className="size-3" />
                  {account ? "עריכה" : "הוספה"}
                </button>
              ) : null}
            </div>
          );
        })}
      </div>
    </section>
  );
}

export function BankLines({ account, compact = false }: { account: BankAccount; compact?: boolean }) {
  const bankLine = [account.bank, account.branch ? `סניף ${account.branch}` : ""].filter(Boolean).join(" · ");
  return (
    <div className={cn("mt-1 space-y-0.5 text-xs font-light text-muted-foreground", compact && "mt-0.5")}>
      {account.holder ? <div>על שם {account.holder}</div> : null}
      {bankLine ? <div>{bankLine}</div> : null}
      {account.account ? <CopyLine label="חשבון" value={account.account} /> : null}
      {account.phone ? <CopyLine label="ביט / פייבוקס" value={account.phone} /> : null}
      {account.note && !compact ? <div className="whitespace-pre-wrap">{account.note}</div> : null}
    </div>
  );
}

function CopyLine({ label, value }: { label: string; value: string }) {
  const [copied, setCopied] = useState(false);
  return (
    <div className="flex items-center gap-1.5">
      <span>{label}</span>
      <span dir="ltr" className="font-medium text-foreground/85 tabular-nums">
        {value}
      </span>
      <button
        type="button"
        aria-label={`העתקת ${label}`}
        className="inline-flex size-6 items-center justify-center rounded-[8px] text-[#9aa1ab] hover:bg-[#eef1f4] hover:text-foreground"
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
      >
        {copied ? <Check className="size-3.5 text-[#3d8f62]" /> : <Copy className="size-3.5" />}
      </button>
    </div>
  );
}

function BankForm({
  member,
  initial,
  onDone,
}: {
  member: Member;
  initial?: BankAccount;
  onDone: () => void;
}) {
  const { act } = useApp();
  const [draft, setDraft] = useState<Draft>(() => ({
    ...EMPTY,
    holder: member.displayName,
    ...(initial ?? {}),
  }));
  const [saving, setSaving] = useState(false);
  const set = (key: keyof Draft) => (event: React.ChangeEvent<HTMLInputElement>) =>
    setDraft((prev) => ({ ...prev, [key]: event.target.value }));

  const save = async (account: Draft | null) => {
    if (saving) return;
    setSaving(true);
    try {
      await act({ type: "setBankAccount", memberId: member.id, account });
      toast.success(account ? "הפרטים נשמרו" : "הפרטים נמחקו");
      onDone();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "השמירה נכשלה");
    } finally {
      setSaving(false);
    }
  };

  return (
    <form
      className="space-y-2 py-3"
      onSubmit={(event) => {
        event.preventDefault();
        void save(draft);
      }}
    >
      <div className="text-sm">{member.displayName}</div>
      <div className="grid gap-2 sm:grid-cols-2">
        <Input value={draft.holder} onChange={set("holder")} placeholder="על שם" maxLength={60} />
        <Input value={draft.bank} onChange={set("bank")} placeholder="בנק" maxLength={40} />
        <Input
          value={draft.branch}
          onChange={set("branch")}
          placeholder="סניף"
          inputMode="numeric"
          dir="ltr"
          className="text-end"
          maxLength={10}
        />
        <Input
          value={draft.account}
          onChange={set("account")}
          placeholder="מספר חשבון"
          inputMode="numeric"
          dir="ltr"
          className="text-end"
          maxLength={30}
        />
        <Input
          value={draft.phone}
          onChange={set("phone")}
          placeholder="טלפון לביט / פייבוקס"
          inputMode="tel"
          dir="ltr"
          className="text-end"
          maxLength={20}
        />
        <Input value={draft.note} onChange={set("note")} placeholder="הערה" maxLength={200} />
      </div>
      <div className="flex flex-wrap gap-2 pt-1">
        <Button type="submit" size="sm" className="rounded-full" disabled={saving}>
          שמירה
        </Button>
        <Button type="button" size="sm" variant="ghost" className="rounded-full" onClick={onDone}>
          ביטול
        </Button>
        {initial ? (
          <Button
            type="button"
            size="sm"
            variant="ghost"
            className="rounded-full text-[#a4453a] hover:text-[#a4453a]"
            disabled={saving}
            onClick={() => void save(null)}
          >
            מחיקת הפרטים
          </Button>
        ) : null}
      </div>
    </form>
  );
}
