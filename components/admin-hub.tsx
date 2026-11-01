"use client";

import { useState, type ReactNode } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import type { LucideIcon } from "lucide-react";
import {
  AlertCircle,
  BellRing,
  CalendarPlus,
  ChevronLeft,
  CircleCheck,
  LayoutGrid,
  Mail,
  MailWarning,
  Phone,
  Send,
  SlidersHorizontal,
  Users,
  Wallet,
} from "lucide-react";
import { toast } from "sonner";
import { useApp } from "@/components/app-provider";
import { MemberRsvpEditor } from "@/components/member-rsvp-editor";
import { UserAvatar } from "@/components/user-avatar";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { boardEnabled, resolveBoard } from "@/lib/community-board";
import { SCOPE_ALL, expensesOpen, formatAgorot, scopedSettlement } from "@/lib/expenses";
import { formatRelativeHe, formatTimeHe, gatheringLabel, memberById, rsvpWithVia } from "@/lib/format";
import { memberAddress, normalizeNudgeSettings, reachableForNudge } from "@/lib/nudge-rules";
import { memberHasPhone } from "@/lib/phone";
import { upcomingGathering } from "@/lib/selectors";
import type { EmailDelivery, Gathering, Member, PublicState } from "@/lib/types";
import { cn } from "@/lib/utils";

export type HubScreen = "account" | "members" | "invites" | "board" | "system";

const PANEL = "overflow-hidden rounded-[1.4rem] border border-[#d5dbe3] bg-[#fbfcfd]";

type Tone = "gold" | "gray" | "green" | "red";

function IconChip({ icon: Icon, tone = "gold" }: { icon: LucideIcon; tone?: Tone }) {
  return (
    <span
      className={cn(
        "grid size-10 shrink-0 place-items-center rounded-2xl",
        tone === "gold" && "bg-[#f5f0e7] text-[#a9782c]",
        tone === "gray" && "bg-[#f1f3f6] text-[#4b5563]",
        tone === "green" && "bg-[#e6f2ea] text-[#3d8f62]",
        tone === "red" && "bg-[#fbeee9] text-[#a4453a]"
      )}
    >
      <Icon className="size-[18px]" />
    </span>
  );
}

function weekday(iso: string) {
  return new Intl.DateTimeFormat("he-IL", { weekday: "long" }).format(new Date(iso));
}

function people(count: number, one: string, many: string) {
  return count === 1 ? one : `${count} ${many}`;
}

type InvitePostResult = {
  error?: string;
  deliveries?: EmailDelivery[];
  sentCount?: number;
  failedCount?: number;
  callCount?: number;
  callFailedCount?: number;
};

async function postInvites(body: Record<string, unknown>) {
  const res = await fetch("/api/invitations", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  const data = (await res.json()) as InvitePostResult;
  if (!res.ok) throw new Error(data.error || "השליחה נכשלה");
  return data;
}

function reportSend(data: InvitePostResult) {
  const deliveries = data.deliveries ?? [];
  const sent = data.sentCount ?? deliveries.filter((row) => row.status === "sent").length;
  const failed = deliveries.filter((row) => row.status !== "sent");
  const called = Number(data.callCount) || 0;
  if (sent && called) toast.success(`נשלחו ${sent} תזכורות, ויצא צינתוק ל־${called}`);
  else if (sent && !failed.length) toast.success(sent === 1 ? "התזכורת נשלחה" : `נשלחו ${sent} תזכורות`);
  else if (sent) toast.success(`נשלחו ${sent}, ${failed.length} לא יצאו: ${failed[0].error ?? "השליחה נכשלה"}`);
  else if (called) toast.success(called === 1 ? "יצא צינתוק" : `יצא צינתוק ל־${called}`);
  else toast.error(failed[0]?.error || "אף תזכורת לא יצאה");
}

type Task = {
  id: string;
  icon: LucideIcon;
  tone: Tone;
  text: string;
  sub: string;
  action: string;
  run: () => void | Promise<void>;
};

function useTasks(state: PublicState | null, event: Gathering | null, onOpen: (screen: HubScreen) => void) {
  const { act } = useApp();
  const router = useRouter();
  const tasks: Task[] = [];
  if (!state) return tasks;
  const nudge = normalizeNudgeSettings(state.nudge?.settings);
  const records = event ? (state.nudge?.events[event.id] ?? {}) : {};

  if (!event) {
    tasks.push({
      id: "no-event",
      icon: CalendarPlus,
      tone: "gold",
      text: "אין חברה קרובה ביומן",
      sub: "כשתיקבע חברה אפשר יהיה לשלוח הזמנות ולעקוב מי מגיע",
      action: "קביעת חברה",
      run: () => router.push("/journal"),
    });
  } else {
    const pending = state.members.filter((member) => (event.rsvps[member.id] ?? "pending") === "pending");
    const reachable = pending.filter(reachableForNudge);
    if (pending.length) {
      const names = pending.slice(0, 2).map((member) => member.displayName.split(" ")[0]);
      const who =
        pending.length === 1
          ? pending[0].displayName
          : pending.length === 2
            ? `${names[0]} ו${names[1]}`
            : `${pending.length} חברים`;
      tasks.push({
        id: "pending",
        icon: BellRing,
        tone: "gold",
        text: `${who} עוד ${pending.length === 1 ? "לא ענה" : "לא ענו"} לחברה של ${weekday(event.startsAt)}`,
        sub: reachable.length
          ? `אפשר לשלוח עכשיו תזכורת במייל ובצינתוק${nudge.enabled ? ", או לחכות לנודניק" : ""}`
          : "אין להם מייל או טלפון, אז צריך להוסיף פרטי קשר",
        action: reachable.length ? "שליחת תזכורת" : "פתיחת ההזמנות",
        run: reachable.length
          ? async () =>
              reportSend(
                await postInvites({ eventId: event.id, memberIds: reachable.map((m) => m.id), variant: "nudge" })
              )
          : () => onOpen("invites"),
      });
      if (!nudge.enabled && reachable.length) {
        tasks.push({
          id: "nudge-off",
          icon: BellRing,
          tone: "gray",
          text: "הנודניק כבוי",
          sub: "כשהוא פועל, מי שלא ענה מקבל תזכורת אוטומטית פעם ביום",
          action: "הפעלת הנודניק",
          run: async () => {
            await act({ type: "setNudgeSettings", settings: { ...nudge, enabled: true } });
            toast.success("הנודניק הופעל");
          },
        });
      }
    }
    const failed = state.members.filter((member) => memberAddress(member) && records[member.id]?.lastStatus === "failed");
    if (failed.length) {
      tasks.push({
        id: "failed",
        icon: MailWarning,
        tone: "red",
        text:
          failed.length === 1
            ? `המייל ל${failed[0].displayName} לא יצא`
            : `${failed.length} מיילים לא יצאו`,
        sub: records[failed[0].id]?.lastError || "השליחה נכשלה",
        action: "פרטים",
        run: () => onOpen("invites"),
      });
    }
  }

  const noEmail = state.members.filter((member) => !memberAddress(member));
  if (noEmail.length) {
    tasks.push({
      id: "no-email",
      icon: Mail,
      tone: "red",
      text: `${people(noEmail.length, `ל${noEmail[0].displayName} אין`, "חברים בלי")} כתובת מייל`,
      sub: noEmail.length === 1 ? "הוא לא מקבל הזמנות ותזכורות" : "הם לא מקבלים הזמנות ותזכורות",
      action: "הוספת כתובות",
      run: () => onOpen("members"),
    });
  }

  if (expensesOpen(state)) {
    const { report } = scopedSettlement(state, SCOPE_ALL);
    const owing = report.rows.filter((row) => row.owesAgorot > 0);
    const total = owing.reduce((sum, row) => sum + row.owesAgorot, 0);
    if (owing.length) {
      tasks.push({
        id: "debts",
        icon: Wallet,
        tone: "gray",
        text: `${people(owing.length, "חבר אחד חייב", "חברים חייבים")} כסף בבאו חשבון`,
        sub: `סך הכל ${formatAgorot(total)} פתוח`,
        action: "שליחת תזכורת",
        run: async () => {
          const data = (await act({ type: "sendExpenseNotice", scope: SCOPE_ALL })) as { mail?: { sent: number } } | undefined;
          const sent = data?.mail?.sent ?? 0;
          toast.success(sent ? `נשלחו ${sent} תזכורות` : "התזכורת נרשמה");
        },
      });
    }
  }
  return tasks;
}

function TaskList({ tasks }: { tasks: Task[] }) {
  const [busy, setBusy] = useState<string | null>(null);
  if (!tasks.length) {
    return (
      <div className={cn(PANEL, "flex items-center gap-3 px-4 py-4 md:px-5")}>
        <IconChip icon={CircleCheck} tone="green" />
        <div>
          <div className="text-[16px]">הכל מסודר</div>
          <div className="text-[12.5px] font-light text-muted-foreground">אין כרגע משהו שמחכה לך</div>
        </div>
      </div>
    );
  }
  return (
    <section className={PANEL} aria-label="מה צריך לעשות עכשיו">
      <div className="flex items-center justify-between gap-3 border-b border-[#e9ecef] px-4 py-3 md:px-5">
        <h2 className="text-[16px] font-normal">מה צריך לעשות עכשיו</h2>
        <span className="rounded-full bg-[#fbeee9] px-2.5 py-0.5 text-[12px] text-[#a4453a]">
          {tasks.length === 1 ? "דבר אחד" : `${tasks.length} דברים`}
        </span>
      </div>
      <ul className="divide-y divide-[#eef0f3]">
        {tasks.map((task) => (
          <li key={task.id} className="flex flex-wrap items-center gap-3 px-4 py-3.5 sm:flex-nowrap md:px-5">
            <IconChip icon={task.icon} tone={task.tone} />
            <div className="min-w-0 flex-1 basis-[calc(100%-3.25rem)] sm:basis-auto">
              <div className="text-[15px]">{task.text}</div>
              <div className="text-[12.5px] font-light leading-5 text-muted-foreground">{task.sub}</div>
            </div>
            <Button
              size="sm"
              className="ms-[3.25rem] rounded-full px-4 sm:ms-0"
              disabled={busy !== null}
              onClick={async () => {
                setBusy(task.id);
                try {
                  await task.run();
                } catch (error) {
                  toast.error(error instanceof Error ? error.message : "הפעולה נכשלה");
                } finally {
                  setBusy(null);
                }
              }}
            >
              {busy === task.id ? "רגע…" : task.action}
            </Button>
          </li>
        ))}
      </ul>
    </section>
  );
}

function DateBox({ iso }: { iso: string }) {
  const date = new Date(iso);
  return (
    <div className="w-[68px] shrink-0 rounded-2xl bg-[#f5f0e7] py-2.5 text-center text-primary">
      <div className="text-[28px] leading-none tabular-nums">{date.getDate()}</div>
      <div className="mt-1 text-[11px]">{new Intl.DateTimeFormat("he-IL", { month: "long" }).format(date)}</div>
    </div>
  );
}

function RsvpBar({ event, members }: { event: Gathering; members: Member[] }) {
  const status = (member: Member) => event.rsvps[member.id] ?? "pending";
  const total = members.length || 1;
  const parts = [
    { id: "yes", label: "מגיעים", color: "bg-[#3d8f62]" },
    { id: "maybe", label: "אולי", color: "bg-[#d9b56f]" },
    { id: "no", label: "לא מגיעים", color: "bg-[#c9b8b5]" },
    { id: "pending", label: "עוד לא ענו", color: "bg-[#dfe3e8]" },
  ].map((part) => ({ ...part, count: members.filter((member) => status(member) === part.id).length }));
  return (
    <div>
      <div className="flex h-2.5 gap-0.5 overflow-hidden rounded-full bg-[#eef0f3]">
        {parts.map((part) =>
          part.count ? <div key={part.id} className={part.color} style={{ width: `${(part.count / total) * 100}%` }} /> : null
        )}
      </div>
      <div className="mt-2.5 flex flex-wrap gap-x-4 gap-y-1 text-[12.5px] text-muted-foreground">
        {parts.map((part) => (
          <span key={part.id} className="inline-flex items-center gap-1.5">
            <span className={cn("size-2 rounded-full", part.color)} />
            <span className="tabular-nums text-foreground">{part.count}</span>
            {part.label}
          </span>
        ))}
      </div>
    </div>
  );
}

function GatheringCard({ state, event, onOpen }: { state: PublicState; event: Gathering; onOpen: (screen: HubScreen) => void }) {
  const { act, refresh } = useApp();
  const [busy, setBusy] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [calling, setCalling] = useState(false);
  const host = memberById(state.members, event.hostId)?.displayName;
  const pending = state.members.filter((member) => (event.rsvps[member.id] ?? "pending") === "pending");
  const withPhone = state.members.filter(memberHasPhone).length;
  const nudge = normalizeNudgeSettings(state.nudge?.settings);
  const records = state.nudge?.events[event.id] ?? {};
  const every = nudge.everyHours === 24 ? "פעם ביום" : nudge.everyHours === 48 ? "כל יומיים" : nudge.everyHours === 72 ? "כל שלושה ימים" : `כל ${nudge.everyHours} שעות`;

  async function remind(member: Member) {
    setBusy(`mail:${member.id}`);
    try {
      reportSend(await postInvites({ eventId: event.id, memberId: member.id, variant: "nudge" }));
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "השליחה נכשלה");
    } finally {
      setBusy(null);
    }
  }

  async function callMember(member: Member) {
    setBusy(`call:${member.id}`);
    try {
      const res = await fetch("/api/tzintuk", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ eventId: event.id, memberId: member.id }),
      });
      const data = (await res.json()) as { error?: string; callCount?: number; calls?: { error?: string }[] };
      if (!res.ok || !data.callCount) {
        toast.error(data.error || data.calls?.[0]?.error || "הצינתוק לא יצא");
        return;
      }
      toast.success(`יצא צינתוק ל${member.displayName}`);
      void refresh();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "הצינתוק לא יצא");
    } finally {
      setBusy(null);
    }
  }

  async function sendTzintukAll() {
    if (calling) return;
    setCalling(true);
    try {
      const res = await fetch("/api/tzintuk", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ eventId: event.id }),
      });
      const data = (await res.json()) as {
        error?: string;
        callCount?: number;
        callFailedCount?: number;
        calls?: { error?: string }[];
      };
      if (!res.ok) {
        toast.error(data.error || "הצינתוק לא יצא");
        return;
      }
      const called = Number(data.callCount) || 0;
      const failed = Number(data.callFailedCount) || 0;
      const reason = data.calls?.find((row) => row.error)?.error || data.error;
      if (called && !failed) toast.success(called === 1 ? "יצא צינתוק" : `יצא צינתוק ל־${called} חברים`);
      else if (called) toast.success(reason ? `יצא ל־${called}, נכשלו ${failed}: ${reason}` : `יצא ל־${called}, נכשלו ${failed}`);
      else toast.error(reason || "הצינתוק לא יצא");
      void refresh();
    } finally {
      setCalling(false);
    }
  }

  return (
    <section className={PANEL} aria-label="החברה הקרובה">
      <div className="md:grid md:grid-cols-[minmax(0,1fr)_300px]">
      <div className="p-5 md:p-6">
        <div className="flex items-center gap-4">
          <DateBox iso={event.startsAt} />
          <div className="min-w-0">
            <div className="text-[12.5px] text-muted-foreground">החברה הקרובה</div>
            <div className="truncate text-[19px] md:text-[20px]">{gatheringLabel(event)}</div>
            <div className="text-[13px] font-light text-muted-foreground">
              {weekday(event.startsAt)} · {formatTimeHe(event.startsAt)}
              {host ? ` · אצל ${host}` : ""}
            </div>
          </div>
        </div>
        <div className="mt-5">
          <RsvpBar event={event} members={state.members} />
        </div>
        <div className="mt-5 grid grid-cols-2 gap-2">
          <Button className="col-span-2 h-11 rounded-full sm:col-span-1" onClick={() => onOpen("invites")}>
            <Send data-icon="inline-start" />
            שליחת הזמנות
          </Button>
          <Button variant="outline" className="h-11 rounded-full px-3" onClick={() => onOpen("invites")}>
            <Users data-icon="inline-start" />
            לכל חבר
          </Button>
          <Button
            variant="outline"
            className="h-11 rounded-full px-3"
            disabled={calling || withPhone === 0}
            onClick={() => void sendTzintukAll()}
          >
            <Phone data-icon="inline-start" />
            {calling ? "מחייג…" : "צינתוק לכולם"}
          </Button>
        </div>
      </div>
      <div className="grid content-start gap-3 border-t border-[#e9ecef] bg-[#f7f3ec] p-5 md:border-s md:border-t-0">
        <div className="text-[13px] text-muted-foreground">עוד לא ענו</div>
        {pending.length ? (
          <ul className="grid gap-2.5">
            {pending.slice(0, 4).map((member) => {
              const record = records[member.id];
              return (
                <li key={member.id} className="flex items-center gap-2.5">
                  <UserAvatar member={member} size="sm" />
                  <div className="min-w-0 flex-1">
                    <div className="truncate text-sm">{member.displayName}</div>
                    <div className="truncate text-[11.5px] font-light text-muted-foreground">
                      {!reachableForNudge(member)
                        ? "אין מייל או טלפון"
                        : record?.lastStatus === "failed"
                          ? "התזכורת האחרונה לא יצאה"
                          : record?.lastAt
                            ? `קיבל תזכורת ${formatRelativeHe(record.lastAt)}`
                            : memberAddress(member)
                              ? "עוד לא קיבל מייל"
                              : "יש טלפון, בלי מייל"}
                    </div>
                  </div>
                  {memberAddress(member) || memberHasPhone(member) ? (
                    <div className="grid shrink-0 gap-1">
                      {memberAddress(member) ? (
                        <button
                          type="button"
                          disabled={busy !== null}
                          onClick={() => void remind(member)}
                          className="inline-flex h-8 items-center justify-center gap-1 rounded-full border border-[#e7dfd2] bg-white px-2.5 text-[12px] text-[#a9782c] disabled:opacity-50"
                        >
                          <Mail className="size-3.5" />
                          {busy === `mail:${member.id}` ? "שולח…" : "תזכורת"}
                        </button>
                      ) : null}
                      {memberHasPhone(member) ? (
                        <button
                          type="button"
                          disabled={busy !== null}
                          onClick={() => void callMember(member)}
                          className="inline-flex h-8 items-center justify-center gap-1 rounded-full border border-[#e7dfd2] bg-white px-2.5 text-[12px] text-[#4b5563] disabled:opacity-50"
                        >
                          <Phone className="size-3.5" />
                          {busy === `call:${member.id}` ? "מחייג…" : "צינתוק"}
                        </button>
                      ) : null}
                    </div>
                  ) : null}
                </li>
              );
            })}
            {pending.length > 4 ? (
              <li className="text-[12px] text-muted-foreground">ועוד {pending.length - 4}…</li>
            ) : null}
          </ul>
        ) : (
          <div className="flex items-center gap-2 text-sm text-[#3d8f62]">
            <CircleCheck className="size-4" />
            כולם ענו
          </div>
        )}
        <label className="mt-1 flex items-center gap-2.5 rounded-2xl border border-[#ebe3d4] bg-white px-3 py-2.5">
          <BellRing className="size-4 shrink-0 text-[#a9782c]" />
          <span className="min-w-0 flex-1 text-[12.5px]">
            <span className="block">{nudge.enabled ? "נודניק פעיל" : "נודניק כבוי"}</span>
            <span className="block font-light text-muted-foreground">
              {nudge.enabled ? `${every}, עד ${nudge.maxPerMember} תזכורות` : "תזכורת אוטומטית למי שלא ענה"}
            </span>
          </span>
          <Switch
            checked={nudge.enabled}
            disabled={saving}
            aria-label="נודניק"
            onCheckedChange={async (on) => {
              setSaving(true);
              try {
                await act({ type: "setNudgeSettings", settings: { ...nudge, enabled: on } });
                toast.success(on ? "הנודניק הופעל" : "הנודניק כובה");
              } catch (error) {
                toast.error(error instanceof Error ? error.message : "השמירה נכשלה");
              } finally {
                setSaving(false);
              }
            }}
          />
        </label>
      </div>
      </div>
      <div className="border-t border-[#e9ecef] px-5 py-4 md:px-6">
        <div className="text-[15px]">עדכון הגעה</div>
        <p className="mt-1 text-[12.5px] font-light text-muted-foreground">
          מי שאמר בעל פה אפשר לעדכן כאן. ליד התשובה ייכתב «ידנית».
        </p>
        <ul className="mt-3 grid gap-2 sm:grid-cols-2">
          {state.members.map((member) => {
            const status = event.rsvps[member.id] ?? "pending";
            return (
              <li key={member.id} className="rounded-2xl bg-[#f7f8fa] px-3 py-2">
                <div className="flex min-w-0 items-center gap-2">
                  <UserAvatar member={member} size="sm" />
                  <span className="min-w-0 truncate text-sm">{member.displayName}</span>
                  <span className="ms-auto shrink-0 text-[12px] font-light text-muted-foreground">
                    {rsvpWithVia(status, event.rsvpVia?.[member.id])}
                  </span>
                </div>
                <MemberRsvpEditor eventId={event.id} memberId={member.id} status={status} className="mt-2" />
              </li>
            );
          })}
        </ul>
      </div>
    </section>
  );
}

function Tile({
  icon,
  tone = "gold",
  title,
  status,
  detail,
  alert,
  onOpen,
  href,
  children,
}: {
  icon: LucideIcon;
  tone?: Tone;
  title: string;
  status: ReactNode;
  detail?: ReactNode;
  alert?: string;
  onOpen?: () => void;
  href?: string;
  children?: ReactNode;
}) {
  const head = (
    <div className="flex items-start gap-3">
      <IconChip icon={icon} tone={tone} />
      <div className="min-w-0 flex-1">
        <div className="flex items-center justify-between gap-2">
          <div className="text-[16px]">{title}</div>
          <ChevronLeft className="size-4 shrink-0 text-[#9aa1ab] transition-colors group-hover:text-foreground" />
        </div>
        <div className="mt-0.5 text-[13.5px] text-foreground/80">{status}</div>
        {detail ? <div className="mt-0.5 text-[12.5px] font-light text-muted-foreground">{detail}</div> : null}
      </div>
    </div>
  );
  return (
    <div className={cn(PANEL, "group flex flex-col p-4 transition-colors hover:border-[#c9b48c] md:p-5")}>
      {href ? (
        <Link href={href} className="text-start">
          {head}
        </Link>
      ) : (
        <button type="button" onClick={onOpen} className="text-start">
          {head}
        </button>
      )}
      {children ? <div className="mt-4">{children}</div> : null}
      {alert ? (
        <div className="mt-3 flex items-center gap-1.5 rounded-xl bg-[#fdf3ef] px-3 py-2 text-[12.5px] text-[#a4453a]">
          <AlertCircle className="size-3.5 shrink-0" />
          {alert}
        </div>
      ) : null}
    </div>
  );
}

function AvatarStack({ members, max = 6 }: { members: Member[]; max?: number }) {
  return (
    <div className="flex -space-x-2 space-x-reverse">
      {members.slice(0, max).map((member) => (
        <UserAvatar key={member.id} member={member} size="sm" className="ring-2 ring-[#fbfcfd]" />
      ))}
      {members.length > max ? (
        <span className="grid size-6 place-items-center rounded-full bg-[#eef0f3] text-[10px] text-muted-foreground ring-2 ring-[#fbfcfd]">
          +{members.length - max}
        </span>
      ) : null}
    </div>
  );
}

export function AdminHub({ onOpen }: { onOpen: (screen: HubScreen) => void }) {
  const { state, me, act, onlineIds } = useApp();
  const [expSaving, setExpSaving] = useState(false);
  const event = state ? upcomingGathering(state) : null;
  const tasks = useTasks(state, event, onOpen);
  if (!state || !me) return null;

  const board = resolveBoard(state);
  const boardOn = boardEnabled(state);
  const noEmail = state.members.filter((member) => !memberAddress(member)).length;
  const expensesOn = expensesOpen(state);
  const { report } = scopedSettlement(state, SCOPE_ALL);
  const owing = report.rows.filter((row) => row.owesAgorot > 0);
  const openAgorot = owing.reduce((sum, row) => sum + row.owesAgorot, 0);
  const lastIvr = state.ivrLog[0];

  return (
    <div className="grid min-w-0 gap-6 [&>*]:min-w-0">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <p className="text-[13px] font-light text-muted-foreground">
            שלום {me.displayName.split(" ")[0]}, זה המצב של החבורה עכשיו
          </p>
          <h1 className="mt-1 text-[1.65rem] font-medium tracking-tight md:text-[2rem]">ניהול החבורה</h1>
        </div>
        <button
          type="button"
          onClick={() => onOpen("account")}
          className="flex items-center gap-2.5 rounded-full border border-[#d5dbe3] bg-[#fbfcfd] py-1.5 pe-4 ps-1.5 text-sm hover:bg-white"
        >
          <UserAvatar member={me} size="sm" />
          החשבון שלי
        </button>
      </div>

      <TaskList tasks={tasks} />

      {event ? <GatheringCard state={state} event={event} onOpen={onOpen} /> : null}

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <Tile
          icon={Users}
          title="חברי החבורה"
          status={`${state.members.length} חברים · ${onlineIds.length === 1 ? "מחובר אחד" : `${onlineIds.length} מחוברים`} עכשיו`}
          detail="הוספה, עריכה ותפקידים"
          alert={noEmail ? `${people(noEmail, "חבר אחד", "חברים")} בלי כתובת מייל` : undefined}
          onOpen={() => onOpen("members")}
        >
          <AvatarStack members={state.members} />
        </Tile>
        <Tile
          icon={LayoutGrid}
          tone={boardOn ? "green" : "gray"}
          title="לוח הבית"
          status={boardOn ? "מוצג בדף הבית" : "כבוי"}
          detail={`${board.notices.length} מודעות · ${board.files.length} דפי לימוד · סקר ${board.poll.closed ? "סגור" : "פתוח"}`}
          onOpen={() => onOpen("board")}
        />
        <Tile
          icon={Wallet}
          title="באו חשבון"
          status={expensesOn ? "מוצג לכל החברים" : "מוסתר מהחברים"}
          detail={owing.length ? `${formatAgorot(openAgorot)} פתוח · ${people(owing.length, "חייב אחד", "חייבים")}` : "אין חובות פתוחים"}
          href="/expenses"
        >
          <label className="flex items-center justify-between gap-3 rounded-xl bg-[#f6f7f9] px-3 py-2 text-[12.5px]">
            הצגת הדף לחברים
            <Switch
              checked={expensesOn}
              disabled={expSaving}
              aria-label="הצגת באו חשבון"
              onCheckedChange={async (checked) => {
                setExpSaving(true);
                try {
                  await act({ type: "setExpensesVisible", visible: checked });
                  toast.success(checked ? "באו חשבון מוצג" : "באו חשבון מוסתר");
                } catch (error) {
                  toast.error(error instanceof Error ? error.message : "העדכון נכשל");
                } finally {
                  setExpSaving(false);
                }
              }}
            />
          </label>
        </Tile>
        <Tile
          icon={SlidersHorizontal}
          tone="gray"
          title="מערכת"
          status={lastIvr ? `IVR אחרון ${formatRelativeHe(lastIvr.at)}` : "הגדרות כלליות"}
          detail="כניסות לאתר והמערכת הטלפונית"
          onOpen={() => onOpen("system")}
        />
      </div>
    </div>
  );
}
