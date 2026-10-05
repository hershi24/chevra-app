"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { Copy, KeyRound, MessageCircle, Pencil, Plus, Search, Trash2, X } from "lucide-react";
import { toast } from "sonner";
import { useApp } from "@/components/app-provider";
import { boardEnabled } from "@/lib/community-board";
import { UserAvatar } from "@/components/user-avatar";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { roleLabel } from "@/lib/format";
import type { Member, Role } from "@/lib/types";
import { cn } from "@/lib/utils";

const PANEL = "overflow-hidden rounded-[1.4rem] border border-[#d5dbe3] bg-[#fbfcfd]";
const COLLAPSED_COUNT = 6;
const ROLES: Role[] = ["admin", "leader", "member"];

function quietRoles() {
  return ROLE_HELP.map((item) => {
    const lines = item.lines.filter((line) => !/צ׳אט|צ'אט|הודע|שיחה|חדר/.test(line));
    if (item.role === "member") lines.unshift("יומן וגלריה");
    return { ...item, lines };
  });
}

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

type Filter = "all" | "online" | Role;

function useOpenChat() {
  const { me, act } = useApp();
  const router = useRouter();
  return async (member: Member) => {
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
  };
}

function sortMembers(members: Member[], onlineIds: string[], meId?: string) {
  const rank = (member: Member) => (member.id === meId ? 0 : onlineIds.includes(member.id) ? 1 : 2);
  return [...members].sort(
    (a, b) =>
      rank(a) - rank(b) ||
      ROLES.indexOf(a.role) - ROLES.indexOf(b.role) ||
      a.displayName.localeCompare(b.displayName, "he")
  );
}

export function MemberAdmin() {
  const { state, me, onlineIds } = useApp();
  const quiet = boardEnabled(state);
  const openChat = useOpenChat();
  const [query, setQuery] = useState("");
  const [filter, setFilter] = useState<Filter>("all");
  const [openId, setOpenId] = useState<string | null>(null);
  const [adding, setAdding] = useState(false);
  const [expanded, setExpanded] = useState(false);

  const members = useMemo(() => state?.members ?? [], [state?.members]);
  const filtered = useMemo(() => {
    const q = query.trim();
    const list = members.filter((member) => {
      if (filter === "online" && !onlineIds.includes(member.id)) return false;
      if (filter !== "all" && filter !== "online" && member.role !== filter) return false;
      if (!q) return true;
      return (
        member.displayName.includes(q) ||
        member.username.includes(q) ||
        member.phone.includes(q) ||
        member.email.includes(q)
      );
    });
    return sortMembers(list, onlineIds, me?.id);
  }, [members, query, filter, onlineIds, me?.id]);

  if (!state || !me) return null;

  const filters: { id: Filter; label: string; count: number }[] = [
    { id: "all", label: "כולם", count: members.length },
    { id: "online", label: "מחוברים", count: members.filter((m) => onlineIds.includes(m.id)).length },
    { id: "admin", label: "מנהלים", count: members.filter((m) => m.role === "admin").length },
    { id: "leader", label: "ראשי חברה", count: members.filter((m) => m.role === "leader").length },
    { id: "member", label: "חברי חבורה", count: members.filter((m) => m.role === "member").length },
  ];
  const narrowed = Boolean(query.trim()) || filter !== "all";
  const collapsible = !narrowed && filtered.length > COLLAPSED_COUNT + 1;
  const shown =
    collapsible && !expanded
      ? filtered.filter((member, index) => index < COLLAPSED_COUNT || member.id === openId)
      : filtered;
  const hidden = filtered.length - shown.length;

  return (
    <div className="space-y-3">
      <div className={PANEL}>
        <div className="flex flex-wrap items-center gap-2.5 border-b border-[#e9ecef] p-3 md:p-3.5">
          <div className="relative min-w-0 basis-full md:flex-1 md:basis-auto">
            <Search className="pointer-events-none absolute top-1/2 start-3 size-4 -translate-y-1/2 text-[#9aa1ab]" />
            <Input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="חיפוש לפי שם, משתמש או טלפון"
              className="h-10 rounded-xl bg-white ps-9"
            />
          </div>
          <Button
            type="button"
            className="h-10 flex-1 rounded-full px-4 md:flex-none"
            variant={adding ? "outline" : "default"}
            onClick={() => setAdding((value) => !value)}
          >
            {adding ? <X data-icon="inline-start" /> : <Plus data-icon="inline-start" />}
            {adding ? "סגירה" : "חבר חדש"}
          </Button>
        </div>

        {adding ? <AddMemberForm onDone={() => setAdding(false)} /> : null}

        <div className="flex gap-1.5 overflow-x-auto px-3 pt-3 [scrollbar-width:none] md:flex-wrap md:px-3.5">
          {filters.map((item) => (
            <button
              key={item.id}
              type="button"
              onClick={() => setFilter(item.id)}
              className={cn(
                "shrink-0 rounded-full border px-3 py-1.5 text-[12px]",
                filter === item.id
                  ? "border-foreground bg-foreground text-white"
                  : "border-[#e3e7ec] bg-white text-[#4b5563]"
              )}
            >
              {item.label}
              <span className={cn("ms-1 tabular-nums", filter === item.id ? "text-white/60" : "text-[#9aa1ab]")}>
                {item.count}
              </span>
            </button>
          ))}
        </div>

        <ul className="mt-2.5">
          {shown.map((member) => (
            <MemberRow
              key={member.id}
              member={member}
              meId={me.id}
              online={onlineIds.includes(member.id)}
              open={openId === member.id}
              onToggle={() => setOpenId((id) => (id === member.id ? null : member.id))}
              onChat={quiet ? undefined : () => void openChat(member)}
            />
          ))}
          {filtered.length === 0 ? (
            <li className="border-t border-[#e9ecef] px-4 py-8 text-center text-sm font-light text-muted-foreground">
              לא נמצאו חברים בהתאמה.
            </li>
          ) : null}
        </ul>

        {collapsible ? (
          <button
            type="button"
            onClick={() => setExpanded((value) => !value)}
            className="flex w-full items-center gap-2 border-t border-[#e9ecef] px-4 py-3.5 text-start text-sm text-primary hover:bg-black/[0.02] md:px-5"
          >
            <Plus className={cn("size-4 transition-transform", expanded && "rotate-45")} />
            {expanded ? "הצגת פחות" : `עוד ${hidden} חברים · הצגת כולם`}
          </button>
        ) : null}
      </div>

      <div className="grid gap-2.5 px-1 text-[12.5px] font-light text-muted-foreground md:grid-cols-3 md:gap-0">
        {(quiet ? quietRoles() : ROLE_HELP).map((item, index) => (
          <div key={item.role} className={cn("leading-relaxed md:px-4", index === 0 ? "md:ps-1" : "md:border-s md:border-[#e3e7ec]")}>
            <div className="mb-0.5 text-[13px] font-normal text-foreground">{item.title}</div>
            {item.lines.join(" · ")}
          </div>
        ))}
      </div>
    </div>
  );
}

function RolePill({ role }: { role: Role }) {
  return (
    <span
      className={cn(
        "shrink-0 rounded-full px-2.5 py-0.5 text-[11px] whitespace-nowrap",
        role === "admin" && "bg-[#f5f0e7] text-primary",
        role === "leader" && "bg-[#eaf0fb] text-[#3b5ea8]",
        role === "member" && "bg-[#eef1f4] text-[#4b5563]"
      )}
    >
      {roleLabel(role)}
    </span>
  );
}

function MemberFace({ member, online }: { member: Member; online: boolean }) {
  return (
    <span className="relative shrink-0">
      <UserAvatar member={member} />
      {online ? (
        <span className="absolute bottom-0 start-0 size-2.5 rounded-full bg-[#3ba55d] ring-2 ring-[#fbfcfd]" />
      ) : null}
    </span>
  );
}

function MemberRow({
  member,
  meId,
  online,
  open,
  onToggle,
  onChat,
}: {
  member: Member;
  meId: string;
  online: boolean;
  open: boolean;
  onToggle: () => void;
  onChat?: () => void;
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
  const [confirmReset, setConfirmReset] = useState(false);
  const isMe = member.id === meId;

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
      await act({ type: "updateMember", memberId: member.id, patch: draft });
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

  async function resetPassword() {
    setSaving(true);
    try {
      await act({ type: "resetMemberPassword", memberId: member.id });
      setConfirmReset(false);
      toast.success("הסיסמה אופסה ל-1234. בכניסה הבאה תופיע בקשה להחליף.");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "האיפוס נכשל");
    } finally {
      setSaving(false);
    }
  }

  return (
    <li className={cn("border-t border-[#e9ecef] first:border-t-0", open && "bg-white")}>
      <div className="flex items-center gap-3 px-3.5 py-2.5 md:px-4.5">
        <MemberFace member={member} online={online} />
        <div className="min-w-0 flex-1">
          <div className="truncate text-sm">
            {member.displayName}
            {isMe ? <span className="ms-1 text-[11px] font-light text-[#9aa1ab]">· אתה</span> : null}
          </div>
          <div className="truncate text-[12px] font-light text-muted-foreground">
            {member.username}
            {member.phone ? ` · ${member.phone}` : ""}
          </div>
        </div>
        <span className="hidden sm:inline">
          <RolePill role={member.role} />
        </span>
        <div className="flex shrink-0 items-center text-[#9aa1ab]">
          {!isMe && onChat ? (
            <Button type="button" variant="ghost" size="icon" className="hidden rounded-xl sm:inline-flex" aria-label="צ׳אט" onClick={onChat}>
              <MessageCircle />
            </Button>
          ) : null}
          <Button
            type="button"
            variant="ghost"
            size="icon"
            className="hidden rounded-xl sm:inline-flex"
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
            <Copy />
          </Button>
          {!isMe ? (
            <Button
              type="button"
              variant="ghost"
              size="icon"
              aria-label="איפוס סיסמה"
              title="איפוס סיסמה"
              aria-expanded={confirmReset}
              className={cn("rounded-xl", confirmReset && "bg-[#f5f0e7] text-primary hover:bg-[#f5f0e7]")}
              onClick={() => setConfirmReset((value) => !value)}
            >
              <KeyRound />
            </Button>
          ) : null}
          <Button
            type="button"
            variant="ghost"
            size="icon"
            aria-label={open ? "סגירת עריכה" : "עריכה"}
            aria-expanded={open}
            className={cn("rounded-xl", open && "bg-[#f5f0e7] text-primary hover:bg-[#f5f0e7]")}
            onClick={() => {
              if (!open) syncDraft();
              onToggle();
            }}
          >
            {open ? <X /> : <Pencil />}
          </Button>
        </div>
      </div>

      {confirmReset && !isMe ? (
        <div className="mx-3 mb-3 flex flex-wrap items-center gap-3 rounded-2xl border border-[#ecdcc0] bg-[#f5f0e7] px-3.5 py-3 md:flex-nowrap">
          <span className="grid size-9 shrink-0 place-items-center rounded-xl bg-white text-primary">
            <KeyRound className="size-4" />
          </span>
          <div className="min-w-0 flex-1">
            <div className="text-[14px]">לאפס את הסיסמה של {member.displayName.split(" ")[0]}?</div>
            <div className="text-[12.5px] font-light text-[#6b5a40]">
              הסיסמה תחזור ל־1234, ובכניסה הבאה הוא יתבקש לבחור סיסמה חדשה.
            </div>
          </div>
          <div className="flex w-full shrink-0 gap-1 md:w-auto">
            <Button
              type="button"
              className="h-9 flex-1 rounded-full px-5 md:flex-none"
              disabled={saving}
              onClick={() => void resetPassword()}
            >
              {saving ? "מאפס…" : "איפוס ל־1234"}
            </Button>
            <Button type="button" variant="ghost" className="h-9 rounded-full" onClick={() => setConfirmReset(false)}>
              ביטול
            </Button>
          </div>
        </div>
      ) : null}

      {open ? (
        <div className="grid gap-2.5 px-3.5 pb-4 md:grid-cols-2 md:px-4.5">
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
            dir="ltr"
            value={draft.phone}
            onChange={(value) => setDraft((prev) => ({ ...prev, phone: value }))}
          />
          <Field
            label="אימייל"
            dir="ltr"
            value={draft.email}
            onChange={(value) => setDraft((prev) => ({ ...prev, email: value }))}
          />
          <RolePicker
            value={draft.role}
            onChange={(role) => setDraft((prev) => ({ ...prev, role }))}
          />
          <div className="flex flex-wrap items-center gap-1.5 md:col-span-2">
            <Button type="button" className="h-9 rounded-full px-5" disabled={saving} onClick={() => void save()}>
              {saving ? "שומר…" : "שמירה"}
            </Button>
            <Button type="button" variant="ghost" className="h-9 rounded-full text-muted-foreground" onClick={onToggle}>
              ביטול
            </Button>
            <div className="ms-auto flex flex-wrap items-center gap-1.5">
              {!isMe ? (
                <Button
                  type="button"
                  variant="ghost"
                  className="h-9 rounded-full text-muted-foreground"
                  disabled={saving}
                  onClick={() => void resetPassword()}
                >
                  <KeyRound data-icon="inline-start" />
                  איפוס סיסמה ל-1234
                </Button>
              ) : null}
              {!isMe ? (
                confirmRemove ? (
                  <>
                    <Button type="button" variant="destructive" className="h-9 rounded-full" disabled={saving} onClick={() => void remove()}>
                      כן, להסיר
                    </Button>
                    <Button type="button" variant="ghost" className="h-9 rounded-full" onClick={() => setConfirmRemove(false)}>
                      לא
                    </Button>
                  </>
                ) : (
                  <Button
                    type="button"
                    variant="ghost"
                    className="h-9 rounded-full text-[#a4453a] hover:bg-[#a4453a]/5 hover:text-[#a4453a]"
                    onClick={() => setConfirmRemove(true)}
                  >
                    <Trash2 data-icon="inline-start" />
                    הסרה מהחבורה
                  </Button>
                )
              ) : null}
            </div>
          </div>
        </div>
      ) : null}
    </li>
  );
}

function RolePicker({
  value,
  onChange,
  disabled,
}: {
  value: Role;
  onChange: (role: Role) => void;
  disabled?: boolean;
}) {
  return (
    <div className="grid gap-1.5 md:col-span-2">
      <span className="text-[12px] text-muted-foreground">תפקיד</span>
      <div role="radiogroup" aria-label="תפקיד" className="grid grid-cols-3 gap-1.5">
        {ROLES.map((role) => (
          <button
            key={role}
            type="button"
            role="radio"
            aria-checked={value === role}
            disabled={disabled}
            onClick={() => onChange(role)}
            className={cn(
              "rounded-xl border py-2 text-[13px] disabled:opacity-60",
              value === role
                ? "border-primary bg-[#f5f0e7] text-primary"
                : "border-[#e3e7ec] bg-white text-[#4b5563] hover:border-[#cfd5dd]"
            )}
          >
            {roleLabel(role)}
          </button>
        ))}
      </div>
    </div>
  );
}

function Field({
  label,
  value,
  onChange,
  dir,
  name,
  required,
  type,
  placeholder,
}: {
  label: string;
  value?: string;
  onChange?: (value: string) => void;
  dir?: "ltr" | "rtl";
  name?: string;
  required?: boolean;
  type?: string;
  placeholder?: string;
}) {
  return (
    <label className="grid gap-1.5 text-[12px] text-muted-foreground">
      {label}
      <Input
        name={name}
        type={type}
        dir={dir}
        required={required}
        placeholder={placeholder}
        value={value}
        onChange={onChange ? (e) => onChange(e.target.value) : undefined}
        className="h-10 rounded-xl bg-white text-sm text-foreground"
      />
    </label>
  );
}

function AddMemberForm({ onDone }: { onDone: () => void }) {
  const { act } = useApp();
  const [role, setRole] = useState<Role>("member");

  return (
    <form
      className="grid gap-2.5 border-b border-[#e9ecef] bg-white p-3.5 md:grid-cols-2 md:p-4"
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
      <div className="text-[15px] md:col-span-2">חבר חדש</div>
      <Field label="שם מלא" name="displayName" required placeholder="יוסף גולדשטיין" />
      <Field label="שם בחבורה" name="username" required placeholder="למשל: יוסי" />
      <Field label="טלפון" name="phone" dir="ltr" placeholder="050..." />
      <Field label="אימייל" name="email" type="email" dir="ltr" />
      <RolePicker value={role} onChange={setRole} />
      <div className="md:col-span-2">
        <Button className="h-10 w-full rounded-full px-6 md:w-auto">הוספת החבר</Button>
      </div>
    </form>
  );
}

export function MemberDirectory({ members }: { members: Member[] }) {
  const { state, me, onlineIds } = useApp();
  const quiet = boardEnabled(state);
  const openChat = useOpenChat();
  const sorted = sortMembers(members, onlineIds, me?.id);
  return (
    <ul className={PANEL}>
      {sorted.map((member) => {
        const isMe = member.id === me?.id;
        return (
          <li
            key={member.id}
            className="flex items-center gap-3 border-t border-[#e9ecef] px-3.5 py-2.5 first:border-t-0 md:px-4.5"
          >
            <MemberFace member={member} online={onlineIds.includes(member.id)} />
            <div className="min-w-0 flex-1">
              <div className="truncate text-sm">
                {member.displayName}
                {isMe ? <span className="ms-1 text-[11px] font-light text-[#9aa1ab]">· אתה</span> : null}
              </div>
              <div className="truncate text-[12px] font-light text-muted-foreground">
                {onlineIds.includes(member.id) ? "מחובר עכשיו" : roleLabel(member.role)}
              </div>
            </div>
            <RolePill role={member.role} />
            {!isMe && !quiet ? (
              <Button
                type="button"
                variant="ghost"
                size="icon"
                className="rounded-xl text-[#9aa1ab]"
                aria-label={`צ׳אט עם ${member.displayName}`}
                onClick={() => void openChat(member)}
              >
                <MessageCircle />
              </Button>
            ) : (
              <span className="size-8 shrink-0" />
            )}
          </li>
        );
      })}
    </ul>
  );
}
