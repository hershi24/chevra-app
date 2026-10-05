"use client";

import { useEffect, useRef, useState, type ReactNode } from "react";
import type { LucideIcon } from "lucide-react";
import { Bell, Eye, Hash, KeyRound, LogOut, Mail, Megaphone, Phone, SlidersHorizontal, User, Users, Wallet } from "lucide-react";
import { toast } from "sonner";
import { useApp } from "@/components/app-provider";
import { MemberAdmin, MemberDirectory } from "@/components/member-admin";
import { UserAvatar } from "@/components/user-avatar";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { formatDateTimeHe, formatRelativeHe, formatTimeHe, gatheringLabel, memberById, roleLabel } from "@/lib/format";
import { expensesOpen } from "@/lib/expenses";
import { can, isAdmin } from "@/lib/permissions";
import { upcomingGathering } from "@/lib/selectors";
import type { ChatEmailMode, ChatEmailPrefs, EmailDelivery, Gathering, Member } from "@/lib/types";
import { cn } from "@/lib/utils";

type SectionId = "account" | "notify" | "members" | "invites" | "system";

const SECTIONS: { id: SectionId; label: string; short: string; icon: LucideIcon }[] = [
  { id: "account", label: "החשבון שלי", short: "החשבון", icon: User },
  { id: "notify", label: "התראות במייל", short: "התראות", icon: Bell },
  { id: "members", label: "חברי החבורה", short: "חברים", icon: Users },
  { id: "invites", label: "הזמנות", short: "הזמנות", icon: Mail },
  { id: "system", label: "מערכת", short: "מערכת", icon: SlidersHorizontal },
];

const PANEL = "overflow-hidden rounded-[1.4rem] border border-[#d5dbe3] bg-[#fbfcfd]";

export function SettingsView() {
  const { state, me, logout, onlineIds } = useApp();
  const [active, setActive] = useState<SectionId>("account");
  const pinnedUntil = useRef(0);

  const visible = SECTIONS.filter((section) => {
    if (!me) return false;
    if (section.id === "invites") return can(me, "sendInvites");
    if (section.id === "system") return isAdmin(me);
    return true;
  });
  const visibleKey = visible.map((section) => section.id).join(",");

  useEffect(() => {
    const ids = visibleKey.split(",").filter(Boolean) as SectionId[];
    let frame = 0;
    const update = () => {
      frame = 0;
      if (performance.now() < pinnedUntil.current) return;
      const atBottom = window.innerHeight + window.scrollY >= document.documentElement.scrollHeight - 4;
      let current = ids[0];
      for (const id of ids) {
        const node = document.getElementById(`settings-${id}`);
        if (node && node.getBoundingClientRect().top <= window.innerHeight * 0.3) current = id;
      }
      setActive(atBottom ? ids[ids.length - 1] : current);
    };
    const onScroll = () => {
      if (!frame) frame = requestAnimationFrame(update);
    };
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => {
      window.removeEventListener("scroll", onScroll);
      if (frame) cancelAnimationFrame(frame);
    };
  }, [visibleKey]);

  if (!state || !me) return null;
  const memberCount = state.members.length;

  function jump(id: SectionId, at: number) {
    setActive(id);
    pinnedUntil.current = at + 900;
    document.getElementById(`settings-${id}`)?.scrollIntoView({ behavior: "smooth", block: "start" });
  }

  return (
    <div>
      <div>
        <p className="text-[13px] font-light text-muted-foreground">
          {isAdmin(me) ? "החשבון, החברים והמערכת" : "החשבון שלך וחברי החבורה"}
        </p>
        <h1 className="mt-1 text-[1.65rem] font-medium tracking-tight md:text-[2rem]">הגדרות</h1>
      </div>

      <div className="mt-4 md:mt-7 md:grid md:grid-cols-[210px_minmax(0,1fr)] md:items-start md:gap-9">
        <aside className="sticky top-24 hidden gap-0.5 md:grid">
          {visible.map((section) => (
            <button
              key={section.id}
              type="button"
              onClick={(e) => jump(section.id, e.timeStamp)}
              className={cn(
                "flex items-center gap-2.5 rounded-[14px] border px-3.5 py-2.5 text-start text-sm transition-colors",
                active === section.id
                  ? "border-[#d5dbe3] bg-[#fbfcfd] text-foreground shadow-[0_6px_16px_rgba(80,90,105,0.06)]"
                  : "border-transparent text-[#3f4650] hover:bg-black/[0.03]"
              )}
            >
              <section.icon className={cn("size-4", active === section.id && "text-primary")} />
              {section.label}
              {section.id === "members" ? (
                <span className="ms-auto text-[11px] text-[#9aa1ab] tabular-nums">{memberCount}</span>
              ) : null}
            </button>
          ))}
          <div className="mx-3.5 my-2.5 border-t border-[#e9ecef]" />
          <button
            type="button"
            onClick={() => void logout()}
            className="flex items-center gap-2.5 rounded-[14px] px-3.5 py-2.5 text-start text-sm text-[#a4453a] hover:bg-[#a4453a]/5"
          >
            <LogOut className="size-4" />
            יציאה מהחשבון
          </button>
        </aside>

        <div className="min-w-0">
          <nav className="sticky top-0 z-10 -mx-5 mb-5 flex gap-1.5 overflow-x-auto bg-background px-5 py-2 [scrollbar-width:none] md:hidden">
            {visible.map((section) => (
              <button
                key={section.id}
                type="button"
                onClick={(e) => jump(section.id, e.timeStamp)}
                className={cn(
                  "shrink-0 rounded-full border px-3.5 py-1.5 text-[13px]",
                  active === section.id
                    ? "border-primary bg-primary text-primary-foreground"
                    : "border-[#d5dbe3] bg-[#fbfcfd] text-[#3f4650]"
                )}
              >
                {section.short}
                {section.id === "members" ? ` · ${memberCount}` : ""}
              </button>
            ))}
          </nav>

          <div className="grid gap-10 md:gap-12 [&>*]:min-w-0">
            <Section id="account" title="החשבון שלי" subtitle="איך החברים רואים אותך, והסיסמה לכניסה.">
              <AccountPanel member={me} online={onlineIds.includes(me.id)} onLogout={() => void logout()} />
            </Section>

            <Section
              id="notify"
              title="התראות במייל"
              subtitle="אילו הודעות בצ׳אט יגיעו אליך גם למייל, עם כפתור השבה ישיר."
            >
              <ChatEmailPanel />
            </Section>

            <Section
              id="members"
              title="חברי החבורה"
              subtitle={`${memberCount} חברים · ${onlineCountLabel(onlineIds.length)}`}
            >
              {can(me, "manageMembers") ? <MemberAdmin /> : <MemberDirectory members={state.members} />}
            </Section>

            {can(me, "sendInvites") ? <InvitesSection /> : null}

            {isAdmin(me) ? (
              <Section id="system" title="מערכת" subtitle="רק למנהל המערכת.">
                <SystemPanel />
              </Section>
            ) : null}
          </div>
        </div>
      </div>
    </div>
  );
}

function onlineCountLabel(count: number) {
  if (count === 0) return "אף אחד לא מחובר עכשיו";
  if (count === 1) return "מחובר אחד עכשיו";
  return `${count} מחוברים עכשיו`;
}

function Section({
  id,
  title,
  subtitle,
  action,
  children,
}: {
  id: SectionId;
  title: string;
  subtitle?: string;
  action?: ReactNode;
  children: ReactNode;
}) {
  return (
    <section id={`settings-${id}`} className="scroll-mt-16 md:scroll-mt-24">
      <div className="mb-3.5 flex items-end justify-between gap-3">
        <div>
          <h2 className="text-[1.2rem] font-normal">{title}</h2>
          {subtitle ? <p className="mt-0.5 text-[13px] font-light text-muted-foreground">{subtitle}</p> : null}
        </div>
        {action}
      </div>
      {children}
    </section>
  );
}

function AccountPanel({ member, online, onLogout }: { member: Member; online: boolean; onLogout: () => void }) {
  const facts = [
    { label: "שם משתמש", value: member.username },
    { label: "טלפון", value: member.phone },
    { label: "מייל", value: member.email?.endsWith("@chevra.local") ? "" : member.email },
  ];
  return (
    <div className={PANEL}>
      <div className="flex items-center gap-4 p-4 md:p-5">
        <span className="relative shrink-0">
          <UserAvatar member={member} size="lg" className="data-[size=lg]:size-14 md:data-[size=lg]:size-16" />
          {online ? (
            <span className="absolute bottom-0.5 start-0.5 size-3.5 rounded-full bg-[#3ba55d] ring-2 ring-[#fbfcfd]" />
          ) : null}
        </span>
        <div className="min-w-0 flex-1">
          <div className="truncate text-lg md:text-xl">{member.displayName}</div>
          <div className="mt-0.5 text-[13px] font-light text-muted-foreground">
            {roleLabel(member.role)}
            {online ? " · מחובר עכשיו" : ""}
          </div>
        </div>
        <Button variant="outline" className="rounded-full" onClick={onLogout}>
          <LogOut data-icon="inline-start" />
          יציאה
        </Button>
      </div>
      <dl className="grid border-t border-[#e9ecef] md:grid-cols-3">
        {facts.map((fact, index) => (
          <div
            key={fact.label}
            className={cn(
              "flex items-center justify-between gap-3 px-4 py-3 md:block md:px-5",
              index > 0 && "border-t border-[#e9ecef] md:border-t-0 md:border-s"
            )}
          >
            <dt className="text-[11px] text-[#9aa1ab]">{fact.label}</dt>
            <dd className="truncate text-sm [unicode-bidi:plaintext]" dir="ltr">
              {fact.value || "—"}
            </dd>
          </div>
        ))}
      </dl>
      <PasswordForm />
    </div>
  );
}

const EMAIL_MODES: { id: ChatEmailMode; title: string; hint: string }[] = [
  { id: "off", title: "לא לקבל", hint: "ההודעות מופיעות רק באתר ובהתראות בטלפון." },
  { id: "dm", title: "רק הודעות פרטיות", hint: "מייל על כל הודעה פרטית שנשלחת אליך." },
  { id: "custom", title: "צ׳אטים שאבחר", hint: "בוחרים חדרים, ואפשר להוסיף גם הודעות פרטיות." },
];

function ChatEmailPanel() {
  const { state, me, act } = useApp();
  const [saving, setSaving] = useState(false);
  if (!state || !me) return null;
  const prefs = state.myChatEmailPrefs;
  const rooms = state.channels.filter((channel) => channel.type !== "dm");
  const email = me.email?.trim() ?? "";
  const hasEmail = Boolean(email) && !email.endsWith("@chevra.local");

  async function save(next: ChatEmailPrefs) {
    setSaving(true);
    try {
      await act({ type: "setChatEmailPrefs", prefs: next });
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "השמירה נכשלה");
    } finally {
      setSaving(false);
    }
  }

  function toggleRoom(id: string, on: boolean) {
    const channelIds = on ? [...prefs.channelIds, id] : prefs.channelIds.filter((item) => item !== id);
    void save({ ...prefs, channelIds });
  }

  return (
    <div className={PANEL}>
      <div className="grid gap-2 p-3 md:grid-cols-3 md:p-4">
        {EMAIL_MODES.map((mode) => {
          const selected = prefs.mode === mode.id;
          return (
            <button
              key={mode.id}
              type="button"
              disabled={saving}
              aria-pressed={selected}
              onClick={() => {
                if (!selected) void save({ ...prefs, mode: mode.id });
              }}
              className={cn(
                "flex items-start gap-3 rounded-2xl border px-3.5 py-3 text-start transition-colors",
                selected ? "border-primary bg-[#f8f1e5]" : "border-[#e3e7ec] bg-white hover:bg-black/[0.02]"
              )}
            >
              <span
                className={cn(
                  "mt-0.5 grid size-[18px] shrink-0 place-items-center rounded-full border",
                  selected ? "border-primary" : "border-[#c5ccd6]"
                )}
              >
                {selected ? <span className="size-2.5 rounded-full bg-primary" /> : null}
              </span>
              <span>
                <span className="block text-[14.5px]">{mode.title}</span>
                <span className="mt-0.5 block text-[12px] font-light leading-5 text-muted-foreground">{mode.hint}</span>
              </span>
            </button>
          );
        })}
      </div>

      {prefs.mode === "custom" ? (
        <div className="divide-y divide-[#e9ecef] border-t border-[#e9ecef]">
          <label className="flex items-center justify-between gap-3 px-4 py-3 md:px-5">
            <span className="flex items-center gap-2.5 text-sm">
              <Mail className="size-4 text-[#6b7280]" />
              הודעות פרטיות
            </span>
            <Switch
              checked={prefs.dm}
              disabled={saving}
              onCheckedChange={(on) => void save({ ...prefs, dm: on })}
            />
          </label>
          {rooms.map((room) => (
            <label key={room.id} className="flex items-center justify-between gap-3 px-4 py-3 md:px-5">
              <span className="flex min-w-0 items-center gap-2.5 text-sm">
                {room.type === "announcements" ? (
                  <Megaphone className="size-4 shrink-0 text-[#6b7280]" />
                ) : (
                  <Hash className="size-4 shrink-0 text-[#6b7280]" />
                )}
                <span className="truncate">{room.name}</span>
              </span>
              <Switch
                checked={prefs.channelIds.includes(room.id)}
                disabled={saving}
                onCheckedChange={(on) => toggleRoom(room.id, on)}
              />
            </label>
          ))}
        </div>
      ) : null}

      <div className="border-t border-[#e9ecef] px-4 py-3 text-[12.5px] font-light text-muted-foreground md:px-5">
        {hasEmail ? (
          <>
            המיילים יישלחו אל{" "}
            <span dir="ltr" className="text-foreground">
              {email}
            </span>
          </>
        ) : (
          <span className="text-[#a4453a]">
            אין כתובת מייל בחשבון שלך, ולכן לא יישלחו מיילים. בקשו מהמנהל להוסיף אותה.
          </span>
        )}
      </div>
    </div>
  );
}

function PasswordForm() {
  const { act } = useApp();
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [saving, setSaving] = useState(false);

  return (
    <div id="password" className="scroll-mt-24 border-t border-[#e9ecef] px-4 pt-4 pb-4 md:px-5 md:pb-5">
      <div className="flex items-center gap-3">
        <span className="grid size-9 shrink-0 place-items-center rounded-xl bg-[#f1f3f6] text-[#4b5563]">
          <KeyRound className="size-4" />
        </span>
        <div>
          <div className="text-[15px]">סיסמה</div>
          <div className="text-[12.5px] font-light text-muted-foreground">
            מומלץ להחליף את הסיסמה הזמנית שקיבלת
          </div>
        </div>
      </div>
      <form
        className="mt-3.5 grid gap-2.5 md:grid-cols-[1fr_1fr_auto] md:items-end"
        onSubmit={async (e) => {
          e.preventDefault();
          setSaving(true);
          try {
            await act({ type: "changePassword", currentPassword, newPassword });
            setCurrentPassword("");
            setNewPassword("");
            toast.success("הסיסמה הוחלפה");
          } catch (error) {
            toast.error(error instanceof Error ? error.message : "ההחלפה נכשלה");
          } finally {
            setSaving(false);
          }
        }}
      >
        <label className="grid gap-1.5 text-[12px] text-muted-foreground">
          סיסמה נוכחית
          <Input
            type="password"
            autoComplete="current-password"
            value={currentPassword}
            onChange={(e) => setCurrentPassword(e.target.value)}
            className="h-10 rounded-xl bg-white"
            required
          />
        </label>
        <label className="grid gap-1.5 text-[12px] text-muted-foreground">
          סיסמה חדשה
          <Input
            type="password"
            autoComplete="new-password"
            value={newPassword}
            onChange={(e) => setNewPassword(e.target.value)}
            className="h-10 rounded-xl bg-white"
            required
          />
        </label>
        <Button type="submit" disabled={saving} className="h-10 rounded-full px-6">
          {saving ? "שומר…" : "שמירה"}
        </Button>
      </form>
    </div>
  );
}

function InvitesSection() {
  const { state, me } = useApp();
  const [sending, setSending] = useState(false);
  const [inviteNote, setInviteNote] = useState("");
  const [deliveries, setDeliveries] = useState<EmailDelivery[] | null>(null);
  const [showReport, setShowReport] = useState(false);

  if (!state || !me) return null;
  const event = upcomingGathering(state);
  const lastLog = state.emailLog.find((entry) => entry.eventId === event?.id);
  const report = deliveries ?? lastLog?.deliveries ?? null;
  const reachable = state.members.filter((member) => {
    const address = member.email?.trim() ?? "";
    return address && !address.endsWith("@chevra.local");
  }).length;
  const unreachable = state.members.length - reachable;

  async function sendInvites() {
    if (!event || sending) return;
    setSending(true);
    try {
      const res = await fetch("/api/invitations", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ eventId: event.id, note: inviteNote }),
      });
      const data = await res.json();
      if (!res.ok) {
        toast.error(data.error || "שליחה נכשלה");
        return;
      }
      setDeliveries(data.deliveries ?? []);
      setShowReport(true);
      if (data.sentCount && !data.failedCount) toast.success(`נשלחו ${data.sentCount} הזמנות`);
      else if (data.sentCount) toast.success(`נשלחו ${data.sentCount}, נכשלו ${data.failedCount}`);
      else toast.error("אף מייל לא נשלח");
    } finally {
      setSending(false);
    }
  }

  async function pingIvr() {
    if (!me) return;
    const res = await fetch("/api/ivr", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ phone: me.phone, digits: "1", action: "tzintuk", eventId: event?.id }),
    });
    const data = await res.json();
    if (!res.ok) {
      toast.error(data.error || "IVR נכשל");
      return;
    }
    toast.success("צילצול / עדכון IVR נרשם");
  }

  const previewHref = event
    ? `/api/invitations/preview?eventId=${encodeURIComponent(event.id)}&note=${encodeURIComponent(inviteNote)}`
    : null;

  return (
    <Section
      id="invites"
      title="הזמנות במייל"
      subtitle="כל חבר מקבל מייל אישי עם כפתורי הגעה — בלי להתחבר."
      action={
        previewHref ? (
          <a
            href={previewHref}
            target="_blank"
            rel="noreferrer"
            className="inline-flex shrink-0 items-center gap-1.5 text-[13px] text-primary hover:underline"
          >
            <Eye className="size-4" />
            תצוגה מקדימה
          </a>
        ) : null
      }
    >
      {event ? (
        <div className={cn(PANEL, "md:grid md:grid-cols-[minmax(0,1fr)_250px]")}>
          <div className="grid gap-3.5 p-4 md:p-5">
            <div className="flex items-center gap-3.5">
              <DateBox iso={event.startsAt} />
              <div className="min-w-0">
                <div className="truncate text-[17px]">{gatheringLabel(event)}</div>
                <div className="text-[12.5px] font-light text-muted-foreground">
                  {weekday(event.startsAt)} · {formatTimeHe(event.startsAt)}
                  {memberById(state.members, event.hostId)
                    ? ` · אצל ${memberById(state.members, event.hostId)!.displayName}`
                    : ""}
                </div>
              </div>
            </div>
            <label className="grid gap-1.5 text-[12px] text-muted-foreground">
              מילה אישית שתופיע בכל הזמנה (לא חובה)
              <Textarea
                rows={3}
                value={inviteNote}
                onChange={(e) => setInviteNote(e.target.value)}
                placeholder="למשל: השבוע נלמד יחד את משנה ה׳. מי שיכול — שיביא סידור."
                className="resize-none rounded-xl bg-white text-sm text-foreground"
              />
            </label>
            <div className="flex flex-wrap items-center gap-2">
              <Button
                onClick={() => void sendInvites()}
                disabled={sending || reachable === 0}
                className="h-10 flex-1 rounded-full px-5 md:flex-none"
              >
                <Mail data-icon="inline-start" />
                {sending ? "שולח…" : `שליחה ל־${reachable} חברים`}
              </Button>
              {can(me, "triggerIvr") ? (
                <Button variant="outline" className="h-10 rounded-full px-4" onClick={() => void pingIvr()}>
                  <Phone data-icon="inline-start" />
                  צינתוק IVR
                </Button>
              ) : null}
              {unreachable ? (
                <span className="w-full text-[12px] font-light text-[#9aa1ab] md:ms-auto md:w-auto">
                  {unreachable === 1 ? "חבר אחד בלי מייל אמיתי לא יקבל" : `${unreachable} חברים בלי מייל אמיתי לא יקבלו`}
                </span>
              ) : null}
            </div>
          </div>
          <InviteSide
            event={event}
            members={state.members}
            report={report}
            sentAt={deliveries ? null : lastLog?.sentAt}
            showReport={showReport}
            onToggleReport={() => setShowReport((value) => !value)}
          />
        </div>
      ) : (
        <div className={cn(PANEL, "px-5 py-8 text-center text-sm font-light text-muted-foreground")}>
          אין חברה קרובה ביומן. אחרי שתיקבע חברה אפשר לשלוח הזמנות מכאן.
        </div>
      )}
    </Section>
  );
}

function weekday(iso: string) {
  return new Intl.DateTimeFormat("he-IL", { weekday: "long" }).format(new Date(iso));
}

function DateBox({ iso }: { iso: string }) {
  const date = new Date(iso);
  return (
    <div className="w-[60px] shrink-0 rounded-2xl bg-[#f5f0e7] py-2 text-center text-primary">
      <div className="text-2xl leading-none tabular-nums">{date.getDate()}</div>
      <div className="mt-1 text-[11px]">{new Intl.DateTimeFormat("he-IL", { month: "long" }).format(date)}</div>
    </div>
  );
}

function InviteSide({
  event,
  members,
  report,
  sentAt,
  showReport,
  onToggleReport,
}: {
  event: Gathering;
  members: Member[];
  report: EmailDelivery[] | null;
  sentAt?: string | null;
  showReport: boolean;
  onToggleReport: () => void;
}) {
  const statuses = members.map((member) => event.rsvps[member.id] ?? "pending");
  const tally = [
    { label: "מגיעים", value: statuses.filter((s) => s === "yes").length, tone: "text-[#3d8f62]" },
    { label: "אולי", value: statuses.filter((s) => s === "maybe").length, tone: "" },
    { label: "טרם", value: statuses.filter((s) => s === "pending").length, tone: "text-[#9aa1ab]" },
  ];
  const sent = report?.filter((row) => row.status === "sent").length ?? 0;
  const failed = report?.filter((row) => row.status === "failed").length ?? 0;
  const skipped = report?.filter((row) => row.status === "skipped").length ?? 0;

  return (
    <div className="grid content-start gap-3 border-t border-[#e9ecef] bg-gradient-to-b from-[#f6f1e8] to-[#fbfcfd] p-4 md:border-s md:border-t-0 md:p-[18px]">
      <div className="text-[13px] text-muted-foreground">מי כבר ענה</div>
      <div className="grid grid-cols-3 gap-1.5">
        {tally.map((item) => (
          <div key={item.label} className="rounded-xl border border-[#ebe3d4] bg-white py-2 text-center">
            <div className={cn("text-xl leading-tight tabular-nums", item.tone)}>{item.value}</div>
            <div className="text-[11px] text-muted-foreground">{item.label}</div>
          </div>
        ))}
      </div>
      {report?.length ? (
        <>
          <div className="mt-1 text-[13px] text-muted-foreground">
            שליחה אחרונה{sentAt ? ` · ${formatRelativeHe(sentAt)}` : " · עכשיו"}
          </div>
          <div className="grid gap-1.5 text-[12.5px]">
            <div className="flex justify-between gap-2">
              <span>{sent} נשלחו</span>
              <span className="text-[#3d8f62]">✓</span>
            </div>
            {failed ? (
              <div className="flex justify-between gap-2 text-destructive">
                <span>{failed} נכשלו</span>
                <span>!</span>
              </div>
            ) : null}
            {skipped ? (
              <div className="flex justify-between gap-2 text-muted-foreground">
                <span>{skipped} לא נשלחו · אין מייל</span>
                <span>—</span>
              </div>
            ) : null}
          </div>
          <button type="button" onClick={onToggleReport} className="justify-self-start text-[12px] text-primary hover:underline">
            {showReport ? "הסתרת הפירוט" : "פירוט לפי חבר"}
          </button>
          {showReport ? (
            <ul className="grid gap-1.5 border-t border-[#ebe3d4] pt-2.5 text-[12px]">
              {report.map((row) => (
                <li key={`${row.name}-${row.to}`} className="flex items-baseline justify-between gap-2">
                  <span className="truncate">{row.name}</span>
                  <span
                    className={cn(
                      "shrink-0",
                      row.status === "failed" ? "text-destructive" : row.status === "sent" ? "text-[#3d8f62]" : "text-muted-foreground"
                    )}
                    title={row.error}
                  >
                    {row.status === "sent" ? "נשלח" : row.status === "failed" ? "נכשל" : "לא נשלח"}
                  </span>
                </li>
              ))}
            </ul>
          ) : null}
          {sentAt ? <div className="text-[11px] text-[#9aa1ab]">{formatDateTimeHe(sentAt)}</div> : null}
        </>
      ) : (
        <div className="text-[12.5px] font-light text-muted-foreground">עוד לא נשלחו הזמנות לחברה הזו.</div>
      )}
    </div>
  );
}

function SystemPanel() {
  const { state, act } = useApp();
  if (!state) return null;
  const visible = expensesOpen(state);
  const lastIvr = state.ivrLog[0];
  return (
    <div className={PANEL}>
      <div className="flex items-center gap-3.5 px-4 py-4 md:px-5">
        <span className="grid size-[38px] shrink-0 place-items-center rounded-xl bg-[#f5f0e7] text-primary">
          <Wallet className="size-4" />
        </span>
        <div className="min-w-0 flex-1">
          <div className="text-[15px]">הצגת באו חשבון</div>
          <div className="text-[12.5px] font-light text-muted-foreground">כיבוי מסתיר את הדף ואת הטאב מכולם</div>
        </div>
        <Switch
          checked={visible}
          onCheckedChange={(checked) =>
            void act({ type: "setExpensesVisible", visible: checked })
              .then(() => toast.success(checked ? "באו חשבון מוצג" : "באו חשבון מוסתר"))
              .catch((error: unknown) => toast.error(error instanceof Error ? error.message : "העדכון נכשל"))
          }
          aria-label="הצגת באו חשבון"
        />
      </div>
      {lastIvr ? (
        <div className="flex items-center gap-3.5 border-t border-[#e9ecef] px-4 py-4 md:px-5">
          <span className="grid size-[38px] shrink-0 place-items-center rounded-xl bg-[#f1f3f6] text-[#4b5563]">
            <Phone className="size-4" />
          </span>
          <div className="min-w-0 flex-1">
            <div className="text-[15px]">IVR אחרון</div>
            <div className="truncate text-[12.5px] font-light text-muted-foreground">
              {lastIvr.result} · <span dir="ltr">{lastIvr.phone}</span> · {formatRelativeHe(lastIvr.at)}
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}
