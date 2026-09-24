"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { Check, Copy, MessageCircle, Pencil, Search, Trash2, UserPlus } from "lucide-react";
import { toast } from "sonner";
import { useApp } from "@/components/app-provider";
import { UserAvatar } from "@/components/user-avatar";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { roleLabel } from "@/lib/format";
import type { Member, Role } from "@/lib/types";
import { cn } from "@/lib/utils";

const ROLE_HELP: { role: Role; title: string; lines: string[] }[] = [
  {
    role: "admin",
    title: "מנהל מערכת",
    lines: ["מוסיף ועורך חברים", "קובע חברות ושולח הזמנות", "מוחק כל הודעה", "כותב בהודעות רשמיות"],
  },
  {
    role: "leader",
    title: "ראש החברה",
    lines: ["שיחה פרטית עם כל חבר", "רואה מי מגיע", "כותב בהודעות רשמיות", "לא נכנס לחדר כללי"],
  },
  {
    role: "member",
    title: "חבר חבורה",
    lines: ["צ׳אט, יומן וגלריה", "אישור הגעה", "מחיקת ההודעות שלו", "בלי ניהול חברים"],
  },
];

export function MemberAdmin() {
  const { state, me, act } = useApp();
  const router = useRouter();
  const [query, setQuery] = useState("");
  const [openId, setOpenId] = useState<string | null>(null);
  const [adding, setAdding] = useState(false);

  const members = state?.members ?? [];
  const filtered = useMemo(() => {
    const q = query.trim();
    if (!q) return members;
    return members.filter(
      (member) =>
        member.displayName.includes(q) ||
        member.username.includes(q) ||
        member.phone.includes(q) ||
        member.email.includes(q)
    );
  }, [members, query]);

  const counts = {
    all: members.length,
    admin: members.filter((member) => member.role === "admin").length,
    leader: members.filter((member) => member.role === "leader").length,
    member: members.filter((member) => member.role === "member").length,
  };

  if (!state || !me) return null;

  async function openChat(member: Member) {
    if (!me || member.id === me.id) return;
    const myId = me.id;
    try {
      const next = await act({ type: "createDm", memberId: member.id });
      const dm = next.channels.find(
        (channel) =>
          channel.type === "dm" &&
          channel.memberIds.includes(myId) &&
          channel.memberIds.includes(member.id)
      );
      if (dm) router.push(`/chat/${dm.id}`);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "לא הצלחנו לפתוח שיחה");
    }
  }

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
        <Stat label="חברים" value={counts.all} />
        <Stat label="מנהלים" value={counts.admin} />
        <Stat label="ראשי חברה" value={counts.leader} />
        <Stat label="חברי חבורה" value={counts.member} />
      </div>

      <div className="relative">
        <Search className="pointer-events-none absolute top-1/2 end-3 size-4 -translate-y-1/2 text-muted-foreground" />
        <Input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="חיפוש לפי שם, משתמש או טלפון"
          className="pe-9"
        />
      </div>

      <ul className="space-y-2">
        {filtered.map((member) => (
          <MemberRow
            key={member.id}
            member={member}
            meId={me.id}
            open={openId === member.id}
            onToggle={() => setOpenId((id) => (id === member.id ? null : member.id))}
            onChat={() => void openChat(member)}
          />
        ))}
        {filtered.length === 0 ? (
          <li className="rounded-xl bg-secondary px-3 py-6 text-center text-sm text-muted-foreground">
            לא נמצאו חברים בהתאמה.
          </li>
        ) : null}
      </ul>

      <div className="rounded-2xl border border-dashed border-black/15 p-4">
        <button
          type="button"
          className="flex w-full items-center gap-2 text-start text-sm font-medium"
          onClick={() => setAdding((value) => !value)}
        >
          <UserPlus className="size-4" />
          {adding ? "סגירת טופס" : "הוספת חבר חדש"}
        </button>
        {adding ? <AddMemberForm onDone={() => setAdding(false)} /> : null}
      </div>

      <div>
        <h3 className="text-sm font-medium">מה כל תפקיד יכול</h3>
        <p className="mt-1 text-[13px] font-light text-muted-foreground">
          כך מחליטים למי לתת מפתח, אם רק ניהול יומיומי או אחריות על החבורה כולה.
        </p>
        <div className="mt-4 grid gap-3 md:grid-cols-3">
          {ROLE_HELP.map((item) => (
            <div key={item.role} className="rounded-2xl bg-secondary px-4 py-3">
              <div className="text-sm font-medium">{item.title}</div>
              <ul className="mt-2 space-y-1.5 text-[13px] font-light text-muted-foreground">
                {item.lines.map((line) => (
                  <li key={line} className="flex gap-2">
                    <Check className="mt-0.5 size-3.5 shrink-0 text-primary" />
                    <span>{line}</span>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

function Stat({ label, value }: { label: string; value: number }) {
  return (
    <div className="rounded-2xl bg-secondary px-3 py-3">
      <div className="text-[1.35rem] font-medium leading-none tabular-nums">{value}</div>
      <div className="mt-1.5 text-[11px] text-muted-foreground">{label}</div>
    </div>
  );
}

function MemberRow({
  member,
  meId,
  open,
  onToggle,
  onChat,
}: {
  member: Member;
  meId: string;
  open: boolean;
  onToggle: () => void;
  onChat: () => void;
}) {
  const { act } = useApp();
  const [draft, setDraft] = useState({
    displayName: member.displayName,
    username: member.username,
    phone: member.phone,
    email: member.email,
    role: member.role,
  });
  const [saving, setSaving] = useState(false);
  const [confirmRemove, setConfirmRemove] = useState(false);

  function syncDraft() {
    setDraft({
      displayName: member.displayName,
      username: member.username,
      phone: member.phone,
      email: member.email,
      role: member.role,
    });
    setConfirmRemove(false);
  }

  async function save() {
    setSaving(true);
    try {
      await act({
        type: "updateMember",
        memberId: member.id,
        patch: draft,
      });
      toast.success("פרטי החבר עודכנו");
      onToggle();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "השמירה נכשלה");
    } finally {
      setSaving(false);
    }
  }

  async function remove() {
    setSaving(true);
    try {
      await act({ type: "removeMember", memberId: member.id });
      toast.success(`${member.displayName} הוסר מהחבורה`);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "ההסרה נכשלה");
      setSaving(false);
    }
  }

  return (
    <li className="rounded-2xl bg-secondary">
      <div className="flex flex-wrap items-center gap-2 px-3 py-2.5">
        <UserAvatar member={member} size="sm" />
        <div className="min-w-0 flex-1">
          <div className="truncate text-sm font-medium">
            {member.displayName}
            {member.id === meId ? (
              <span className="ms-1 text-[11px] font-light text-muted-foreground">אתם</span>
            ) : null}
          </div>
          <div className="truncate text-[11px] text-muted-foreground">
            {member.username}
            {member.phone ? ` · ${member.phone}` : ""}
          </div>
        </div>
        <span className="rounded-full bg-white px-2 py-0.5 text-[11px] text-muted-foreground">
          {roleLabel(member.role)}
        </span>
        {member.id !== meId ? (
          <Button type="button" variant="ghost" size="icon-sm" aria-label="צ׳אט" onClick={onChat}>
            <MessageCircle className="size-4" />
          </Button>
        ) : null}
        <Button
          type="button"
          variant="ghost"
          size="icon-sm"
          aria-label="העתקת שם משתמש"
          onClick={async () => {
            try {
              await navigator.clipboard.writeText(member.username);
              toast.success("השם הועתק");
            } catch {
              toast.error("ההעתקה נכשלה");
            }
          }}
        >
          <Copy className="size-4" />
        </Button>
        <Button
          type="button"
          variant="outline"
          size="xs"
          onClick={() => {
            if (!open) syncDraft();
            onToggle();
          }}
        >
          <Pencil data-icon="inline-start" />
          {open ? "סגור" : "עריכה"}
        </Button>
      </div>
      {open ? (
        <div className="space-y-3 border-t border-black/6 px-3 py-3">
          <div className="grid gap-2 md:grid-cols-2">
            <Field
              label="שם מלא"
              value={draft.displayName}
              onChange={(value) => setDraft((prev) => ({ ...prev, displayName: value }))}
            />
            <Field
              label="שם בחבורה"
              value={draft.username}
              onChange={(value) => setDraft((prev) => ({ ...prev, username: value }))}
            />
            <Field
              label="טלפון"
              value={draft.phone}
              onChange={(value) => setDraft((prev) => ({ ...prev, phone: value }))}
            />
            <Field
              label="אימייל"
              value={draft.email}
              onChange={(value) => setDraft((prev) => ({ ...prev, email: value }))}
            />
            <label className="grid gap-1.5 md:col-span-2">
              <span className="text-sm font-medium">תפקיד</span>
              <select
                className="h-8 rounded-lg border border-input bg-white px-2.5 text-sm"
                value={draft.role}
                onChange={(e) => setDraft((prev) => ({ ...prev, role: e.target.value as Role }))}
              >
                <option value="member">חבר חבורה</option>
                <option value="leader">ראש החברה</option>
                <option value="admin">מנהל מערכת</option>
              </select>
            </label>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <Button type="button" disabled={saving} onClick={() => void save()}>
              {saving ? "שומר…" : "שמירת שינויים"}
            </Button>
            {member.id !== meId ? (
              confirmRemove ? (
                <>
                  <Button type="button" variant="destructive" disabled={saving} onClick={() => void remove()}>
                    כן, להסיר
                  </Button>
                  <Button type="button" variant="outline" onClick={() => setConfirmRemove(false)}>
                    ביטול
                  </Button>
                </>
              ) : (
                <Button
                  type="button"
                  variant="ghost"
                  className="text-destructive hover:bg-destructive/10 hover:text-destructive"
                  onClick={() => setConfirmRemove(true)}
                >
                  <Trash2 data-icon="inline-start" />
                  הסרה מהחבורה
                </Button>
              )
            ) : (
              <p className="text-[12px] text-muted-foreground">לא ניתן להסיר את עצמכם.</p>
            )}
            <Button
              type="button"
              variant="outline"
              disabled={saving}
              onClick={async () => {
                setSaving(true);
                try {
                  await act({ type: "resetMemberPassword", memberId: member.id });
                  toast.success("הסיסמה אופסה ל-1234. בכניסה הבאה תופיע בקשה להחליף.");
                } catch (error) {
                  toast.error(error instanceof Error ? error.message : "האיפוס נכשל");
                } finally {
                  setSaving(false);
                }
              }}
            >
              איפוס סיסמה ל-1234
            </Button>
          </div>
        </div>
      ) : null}
    </li>
  );
}

function Field({
  label,
  value,
  onChange,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
}) {
  return (
    <label className="grid gap-1.5">
      <span className="text-sm font-medium">{label}</span>
      <Input value={value} onChange={(e) => onChange(e.target.value)} />
    </label>
  );
}

function AddMemberForm({ onDone }: { onDone: () => void }) {
  const { act } = useApp();
  const [role, setRole] = useState<Role>("member");

  return (
    <form
      className="mt-4 grid gap-2 md:grid-cols-2"
      onSubmit={async (e) => {
        e.preventDefault();
        const form = e.currentTarget;
        const data = new FormData(form);
        try {
          await act({
            type: "addMember",
            username: String(data.get("username")),
            displayName: String(data.get("displayName")),
            phone: String(data.get("phone")),
            email: String(data.get("email")),
            role,
          });
          form.reset();
          setRole("member");
          toast.success("החבר נוסף לחבורה");
          onDone();
        } catch (error) {
          toast.error(error instanceof Error ? error.message : "שגיאה");
        }
      }}
    >
      <div className="grid gap-1.5">
        <Label htmlFor="new-username">שם בחבורה</Label>
        <Input id="new-username" name="username" required placeholder="למשל: יוסי" />
      </div>
      <div className="grid gap-1.5">
        <Label htmlFor="new-displayName">שם מלא</Label>
        <Input id="new-displayName" name="displayName" required placeholder="יוסף גולדשטיין" />
      </div>
      <div className="grid gap-1.5">
        <Label htmlFor="new-phone">טלפון</Label>
        <Input id="new-phone" name="phone" placeholder="050..." />
      </div>
      <div className="grid gap-1.5">
        <Label htmlFor="new-email">אימייל</Label>
        <Input id="new-email" name="email" type="email" />
      </div>
      <label className="grid gap-1.5 md:col-span-2">
        <span className="text-sm font-medium">תפקיד</span>
        <select
          className="h-8 rounded-lg border border-input bg-white px-2.5 text-sm"
          value={role}
          onChange={(e) => setRole(e.target.value as Role)}
        >
          <option value="member">חבר חבורה</option>
          <option value="leader">ראש החברה</option>
          <option value="admin">מנהל מערכת</option>
        </select>
      </label>
      <Button className="md:col-span-2">הוספת החבר</Button>
    </form>
  );
}

export function MemberDirectory({ members }: { members: Member[] }) {
  return (
    <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
      {members.map((member) => (
        <div key={member.id} className={cn("flex items-center gap-2")}>
          <UserAvatar member={member} />
          <div>
            <div className="text-sm font-medium">{member.displayName}</div>
            <div className="text-xs text-muted-foreground">{roleLabel(member.role)}</div>
          </div>
        </div>
      ))}
    </div>
  );
}
