"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { motion } from "framer-motion";
import {
  BookOpen,
  Check,
  ChevronDown,
  Home,
  Images,
  MapPin,
  MessageCircle,
  Pencil,
  Plus,
  Receipt,
  UtensilsCrossed,
  type LucideIcon,
} from "lucide-react";
import { toast } from "sonner";
import { useApp } from "@/components/app-provider";
import { Countdown } from "@/components/countdown";
import { EventDialog } from "@/components/event-dialog";
import { UserAvatar } from "@/components/user-avatar";
import { Button } from "@/components/ui/button";
import { expensesOpen, formatAgorot, settlement } from "@/lib/expenses";
import {
  formatHebrewDate,
  formatRelativeHe,
  formatTimeHe,
  gatheringTitle,
  memberById,
  rsvpLabel,
} from "@/lib/format";
import { can } from "@/lib/permissions";
import { dmName, galleryItems, upcomingGathering } from "@/lib/selectors";
import type { Gathering, Member, Message, PublicState, RsvpStatus } from "@/lib/types";
import { cn } from "@/lib/utils";

const SEEN_KEY = "chevra-dashboard-seen";
const CARD =
  "rounded-[1.5rem] border border-[#d5dbe3] bg-[#fbfcfd] shadow-[0_10px_28px_rgba(80,90,105,0.05)]";

export function DashboardView() {
  const { state, me, act } = useApp();
  if (!state || !me) return null;
  return <Dashboard state={state} me={me} act={act} />;
}

function useLastVisit(memberId: string) {
  const key = `${SEEN_KEY}:${memberId}`;
  const [since] = useState<number | null>(() => {
    if (typeof window === "undefined") return null;
    const value = Number(window.localStorage.getItem(key));
    return Number.isFinite(value) && value > 0 ? value : null;
  });
  useEffect(() => {
    window.localStorage.setItem(key, String(Date.now()));
  }, [key]);
  return since;
}

function dayDiff(iso: string) {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const day = new Date(iso);
  day.setHours(0, 0, 0, 0);
  return Math.round((day.getTime() - today.getTime()) / 86_400_000);
}

function weekday(iso: string | Date) {
  return new Intl.DateTimeFormat("he-IL", { weekday: "long" }).format(new Date(iso));
}

function greeting() {
  const hour = new Date().getHours();
  if (hour >= 5 && hour < 12) return "בוקר טוב";
  if (hour >= 12 && hour < 17) return "צהריים טובים";
  if (hour >= 17 && hour < 22) return "ערב טוב";
  return "לילה טוב";
}

function headline(event: Gathering | null) {
  if (!event) return "לוח החבורה";
  const diff = dayDiff(event.startsAt);
  if (diff <= 0) return "נתראה היום";
  if (diff === 1) return "נתראה מחר";
  if (diff < 7) return `נתראה ב${weekday(event.startsAt)}`;
  return "החברה הבאה";
}

function daysLeftText(event: Gathering | null) {
  if (!event) return "אין חברה קרובה ביומן";
  const diff = dayDiff(event.startsAt);
  if (diff <= 0) return "החברה הבאה היום";
  if (diff === 1) return "החברה הבאה מחר";
  return `עוד ${diff} ימים לחברה הבאה`;
}

function messagePreview(msg: Message) {
  if (msg.text.trim()) return msg.text;
  if (msg.poll) return `סקר: ${msg.poll.question}`;
  if (msg.voiceUrl) return "הודעה קולית";
  const first = msg.attachments[0];
  if (first?.type === "image") return "תמונה";
  if (first?.type === "video") return "סרטון";
  if (first?.type === "audio") return "הקלטה";
  return first ? "קובץ" : "";
}

function Dashboard({
  state,
  me,
  act,
}: {
  state: PublicState;
  me: Member;
  act: ReturnType<typeof useApp>["act"];
}) {
  const since = useLastVisit(me.id);
  const event = upcomingGathering(state);
  const [now] = useState(() => Date.now());

  const myChannels = state.channels.filter((c) => c.memberIds.includes(me.id));
  const channelById = new Map(myChannels.map((c) => [c.id, c]));
  const myMessages = state.messages
    .filter((m) => channelById.has(m.channelId))
    .sort((a, b) => +new Date(b.createdAt) - +new Date(a.createdAt));
  const latestMessages = myMessages.slice(0, 4);
  const newMessages =
    since === null
      ? 0
      : myMessages.filter((m) => m.authorId !== me.id && +new Date(m.createdAt) > since).length;

  const gallery = galleryItems(state).filter((i) => i.type === "image" || i.type === "video");
  const newPhotos =
    since === null
      ? 0
      : gallery.filter((i) => i.uploadedBy !== me.id && +new Date(i.createdAt) > since).length;

  const past = state.gatherings
    .filter((g) => g.status !== "cancelled" && +new Date(g.startsAt) < now)
    .sort((a, b) => +new Date(b.startsAt) - +new Date(a.startsAt));
  const lastPast = past[0] ?? null;
  const lastWithPhotos =
    past.find((g) => g.media.some((i) => i.type === "image" || i.type === "video")) ?? null;

  const showExpenses = expensesOpen(state);
  const myRow = showExpenses
    ? settlement(state.expenses ?? [], state.members.map((m) => m.id)).rows.find(
        (row) => row.memberId === me.id
      )
    : undefined;
  const expenseSub = !myRow
    ? "הכל מאוזן"
    : myRow.owesAgorot > 0
      ? `לתשלום: ${formatAgorot(myRow.owesAgorot)}`
      : myRow.balanceAgorot > 0
        ? `מגיע לך: ${formatAgorot(myRow.balanceAgorot)}`
        : "הכל מאוזן";

  const channelLabel = (channelId: string) => {
    const channel = channelById.get(channelId);
    if (!channel) return "";
    if (channel.type !== "dm") return channel.name;
    return dmName(
      channel.name,
      channel.memberIds,
      me.id,
      (id) => memberById(state.members, id)?.displayName ?? ""
    );
  };

  const onRsvp = async (status: RsvpStatus) => {
    if (!event) return;
    try {
      await act({ type: "rsvp", eventId: event.id, status });
      toast.success("ההגעה עודכנה");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "שגיאה");
    }
  };

  return (
    <div className="mx-auto flex max-w-5xl flex-col gap-5 md:gap-6">
      <header className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="text-[13px] font-light text-muted-foreground">
            {greeting()}, {me.displayName.split(" ")[0]} 👋
          </p>
          <h1 className="mt-1 text-[1.6rem] font-normal tracking-tight text-foreground md:text-[1.9rem]">
            {headline(event)}
          </h1>
        </div>
        <div className="flex items-end gap-3">
          <div className="flex-1 rounded-2xl border border-[#d5dbe3] bg-[#fbfcfd] px-3.5 py-2 text-[12px] font-light text-muted-foreground sm:flex-none sm:border-0 sm:bg-transparent sm:p-0 sm:text-end">
            <span className="block text-[14px] font-normal text-foreground">
              {weekday(new Date())} · {formatHebrewDate(new Date().toISOString())}
            </span>
            {daysLeftText(event)}
          </div>
          {can(me, "createEvent") ? (
            <EventDialog
              trigger={
                <Button variant="outline" className="shrink-0 rounded-full bg-[#fbfcfd] px-4 font-normal">
                  <Plus data-icon="inline-start" />
                  חברה חדשה
                </Button>
              }
            />
          ) : null}
        </div>
      </header>

      {event ? (
        <HeroEvent event={event} members={state.members} me={me} onRsvp={onRsvp} />
      ) : (
        <section className={cn(CARD, "px-6 py-12")}>
          <p className="text-muted-foreground">אין חברה קרובה ביומן כרגע.</p>
          {can(me, "createEvent") ? (
            <div className="mt-4">
              <EventDialog trigger={<Button variant="outline" className="rounded-full">קביעת חברה</Button>} />
            </div>
          ) : (
            <p className="mt-2 text-sm font-light text-muted-foreground">
              כשמנהל המערכת יקבע חברה — היא תופיע כאן.
            </p>
          )}
        </section>
      )}

      <section
        className={cn(
          "grid grid-cols-2 gap-2.5 md:gap-3.5",
          showExpenses ? "lg:grid-cols-4" : "lg:grid-cols-3"
        )}
      >
        <QuickTile
          href="/chat"
          icon={MessageCircle}
          title="צ׳אט"
          sub={
            newMessages
              ? `${newMessages} הודעות חדשות`
              : latestMessages[0]
                ? `הודעה אחרונה ${formatRelativeHe(latestMessages[0].createdAt)}`
                : "עוד אין הודעות"
          }
          count={newMessages}
        />
        <QuickTile
          href="/gallery"
          icon={Images}
          title="גלריה"
          sub={
            newPhotos
              ? `${newPhotos} חדשות`
              : gallery.length
                ? `${gallery.length} תמונות וסרטונים`
                : "עוד אין תמונות"
          }
          count={newPhotos}
        />
        <QuickTile
          href="/journal"
          icon={BookOpen}
          title="יומן"
          sub={lastPast?.summary?.trim() ? "סיכום החברה האחרונה" : "כל החברות שהיו"}
        />
        {showExpenses ? (
          <QuickTile href="/expenses" icon={Receipt} title="באו חשבון" sub={expenseSub} />
        ) : null}
      </section>

      <section
        className={cn(
          "grid grid-cols-1 gap-4 md:gap-5",
          lastWithPhotos && "lg:grid-cols-[1.15fr_1fr]"
        )}
      >
        <div className={cn(CARD, "min-w-0 px-5 py-5 md:px-6")}>
          <CardHead title="מה חדש בצ׳אט" href="/chat" link="לכל הצ׳אט" />
          {latestMessages.length ? (
            <ul className="divide-y divide-[#eef0f3]">
              {latestMessages.map((msg) => {
                const author = memberById(state.members, msg.authorId);
                return (
                  <li key={msg.id}>
                    <Link href="/chat" className="flex gap-3 py-2.5">
                      <UserAvatar member={author} size="sm" />
                      <div className="min-w-0 flex-1">
                        <div className="flex items-baseline gap-2 text-[13px]">
                          <span className="truncate font-normal">{author?.displayName}</span>
                          <span className="shrink-0 text-[11px] font-light text-muted-foreground">
                            {formatRelativeHe(msg.createdAt)}
                          </span>
                          <span className="ms-auto shrink-0 truncate text-[11px] font-light text-muted-foreground/80">
                            {channelLabel(msg.channelId)}
                          </span>
                        </div>
                        <p className="font-chat truncate text-[13px] font-normal text-foreground/70">
                          {messagePreview(msg)}
                        </p>
                      </div>
                    </Link>
                  </li>
                );
              })}
            </ul>
          ) : (
            <p className="py-4 text-sm font-light text-muted-foreground">עוד אין הודעות בצ׳אט.</p>
          )}
        </div>

        {lastWithPhotos ? <LastGatheringCard event={lastWithPhotos} /> : null}
      </section>
    </div>
  );
}

function CardHead({ title, href, link }: { title: string; href: string; link: string }) {
  return (
    <div className="mb-2 flex items-baseline justify-between gap-3">
      <h2 className="text-[16px] font-normal">{title}</h2>
      <Link href={href} className="text-[13px] font-light text-primary/85 hover:text-primary">
        {link} ←
      </Link>
    </div>
  );
}

function QuickTile({
  href,
  icon: Icon,
  title,
  sub,
  count,
}: {
  href: string;
  icon: LucideIcon;
  title: string;
  sub: string;
  count?: number;
}) {
  return (
    <Link
      href={href}
      className="flex min-w-0 items-center gap-3 rounded-[1.25rem] border border-[#d5dbe3] bg-[#fbfcfd] p-3 transition hover:border-[#c5ccd6] hover:bg-white md:gap-3.5 md:px-4 md:py-3.5"
    >
      <span className="grid size-9 shrink-0 place-items-center rounded-xl bg-[#f1f3f5] text-primary/80 md:size-10">
        <Icon className="size-[18px]" aria-hidden />
      </span>
      <span className="min-w-0 flex-1">
        <span className="block text-[14px] font-normal md:text-[15px]">{title}</span>
        <span className="block truncate text-[12px] font-light text-muted-foreground">{sub}</span>
      </span>
      {count ? (
        <span className="shrink-0 rounded-full bg-[#f3ede3] px-2 py-0.5 text-[11px] tabular-nums text-primary">
          {count}
        </span>
      ) : null}
    </Link>
  );
}

function LastGatheringCard({ event }: { event: Gathering }) {
  const media = event.media.filter((i) => i.type === "image" || i.type === "video");
  const shown = media.slice(0, 6);
  const extra = media.length - 6;
  const summary = event.summary?.trim();

  return (
    <div className={cn(CARD, "min-w-0 px-5 py-5 md:px-6")}>
      <CardHead title="מהחברה האחרונה" href="/gallery" link="לגלריה" />
      <div className="grid grid-cols-3 gap-1.5">
        {shown.map((item, index) => (
          <Link
            key={item.id}
            href="/gallery"
            className="relative block aspect-square overflow-hidden rounded-xl bg-[#eef0f3]"
          >
            {item.type === "video" ? (
              <video
                src={`${item.url}#t=0.1`}
                muted
                playsInline
                preload="metadata"
                className="size-full object-cover"
              />
            ) : (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={item.url} alt={item.caption ?? ""} loading="lazy" className="size-full object-cover" />
            )}
            {index === 5 && extra > 0 ? (
              <span className="absolute inset-0 grid place-items-center bg-black/40 text-lg text-white">
                +{extra}
              </span>
            ) : null}
          </Link>
        ))}
      </div>
      {summary ? (
        <p className="mt-3 line-clamp-3 text-[13px] font-light leading-6 text-foreground/70">
          ״{summary}״
        </p>
      ) : null}
    </div>
  );
}

function HeroEvent({
  event,
  members,
  me,
  onRsvp,
}: {
  event: Gathering;
  members: Member[];
  me: Member;
  onRsvp: (status: RsvpStatus) => Promise<void>;
}) {
  const [listOpen, setListOpen] = useState(false);
  const host = memberById(members, event.hostId);
  const kibud = memberById(members, event.kibudId);
  const lecturer = memberById(members, event.lecturerId);
  const mine = event.rsvps[me.id] ?? "pending";
  const coming = members.filter((m) => event.rsvps[m.id] === "yes");
  const maybe = members.filter((m) => event.rsvps[m.id] === "maybe");
  const pending = members.filter((m) => (event.rsvps[m.id] ?? "pending") === "pending");
  const showList = can(me, "viewRsvps");
  const title = gatheringTitle(event);
  const topic = event.topic?.trim() || null;
  const heading = topic || title || "החברה הבאה";
  const sub = topic && title ? title : null;
  const date = new Date(event.startsAt);
  const dayNum = new Intl.DateTimeFormat("he-IL", { day: "numeric" }).format(date);
  const month = new Intl.DateTimeFormat("he-IL", { month: "long" }).format(date);
  const roles = [
    { member: host, label: "מארח" },
    { member: kibud, label: "כיבוד" },
    { member: lecturer, label: "מעביר השיעור" },
  ].filter((r): r is { member: Member; label: string } => Boolean(r.member));

  return (
    <motion.section
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.45, ease: "easeOut" }}
      className={cn(CARD, "grid min-w-0 overflow-hidden lg:grid-cols-[1fr_18rem]")}
    >
      <div className="relative min-w-0 space-y-5 px-5 py-6 md:space-y-6 md:px-8 md:py-8">
        {can(me, "editEvent") ? (
          <div className="absolute end-4 top-4 md:end-6 md:top-6">
            <EventDialog
              event={event}
              trigger={
                <Button type="button" variant="ghost" size="xs" className="rounded-full text-muted-foreground">
                  <Pencil data-icon="inline-start" />
                  עריכה
                </Button>
              }
            />
          </div>
        ) : null}

        <div className={cn("flex items-center gap-4", can(me, "editEvent") && "pe-16")}>
          <div className="w-[3.9rem] shrink-0 rounded-2xl bg-[#f5f0e7] py-2.5 text-center text-primary/90 md:w-[4.4rem]">
            <div className="text-[1.6rem] leading-none tabular-nums md:text-[1.8rem]">{dayNum}</div>
            <div className="mt-1 text-[11px] font-light">{month}</div>
          </div>
          <div className="min-w-0">
            <p className="text-[12px] font-light text-primary/85">
              {weekday(event.startsAt)} · {formatTimeHe(event.startsAt)}
            </p>
            <h2 className="mt-0.5 text-[1.45rem] font-normal leading-tight tracking-tight md:text-[1.8rem]">
              {heading}
            </h2>
            <p className="mt-0.5 text-[13px] font-light text-muted-foreground">
              {formatHebrewDate(event.startsAt)}
              {sub ? ` · ${sub}` : ""}
            </p>
          </div>
        </div>

        <div className="flex flex-wrap gap-2">
          {event.location ? <DetailChip icon={MapPin}>{event.location}</DetailChip> : null}
          {host ? <DetailChip icon={Home}>אצל {host.displayName}</DetailChip> : null}
          {kibud ? <DetailChip icon={UtensilsCrossed}>כיבוד: {kibud.displayName}</DetailChip> : null}
          {lecturer ? <DetailChip icon={BookOpen}>שיעור: {lecturer.displayName}</DetailChip> : null}
        </div>

        <Countdown iso={event.startsAt} />

        <div className="flex flex-wrap items-center gap-2">
          <span className="w-full text-[13px] font-light text-muted-foreground sm:me-1 sm:w-auto">
            {mine === "pending" ? "אתה מגיע?" : "התשובה שלך"}
          </span>
          <RsvpButton active={mine === "yes"} tone="yes" onClick={() => void onRsvp("yes")}>
            {mine === "yes" ? <Check className="size-4" aria-hidden /> : null}
            מאשר הגעה
          </RsvpButton>
          <RsvpButton active={mine === "maybe"} tone="maybe" onClick={() => void onRsvp("maybe")}>
            אולי
          </RsvpButton>
          <RsvpButton active={mine === "no"} tone="no" onClick={() => void onRsvp("no")}>
            לא אוכל
          </RsvpButton>
        </div>
      </div>

      <aside className="min-w-0 space-y-4 border-t border-[#eceae5] bg-[#f8f7f4] px-5 py-6 lg:border-s lg:border-t-0 lg:px-6 lg:py-7">
        <div className="flex items-baseline justify-between text-[13px] font-light text-muted-foreground">
          <span>מי מגיע</span>
          <span>מתוך {members.length}</span>
        </div>
        <div className="flex items-center gap-3.5">
          <Ring value={coming.length} total={members.length} />
          <div>
            <div className="text-[1.35rem] leading-none">{coming.length} מגיעים</div>
            <div className="mt-1.5 text-[12px] font-light text-muted-foreground">
              {maybe.length} אולי · {pending.length} עוד לא ענו
            </div>
          </div>
        </div>
        {coming.length ? (
          <div className="flex -space-x-2 space-x-reverse">
            {coming.slice(0, 8).map((member) => (
              <UserAvatar key={member.id} member={member} className="ring-2 ring-[#f8f7f4]" />
            ))}
          </div>
        ) : null}
        {roles.length ? (
          <div className="space-y-2">
            {roles.map((role) => (
              <div
                key={role.label}
                className="flex items-center gap-2.5 rounded-xl border border-[#ebe8e1] bg-white px-3 py-2"
              >
                <UserAvatar member={role.member} size="sm" />
                <div className="min-w-0 text-[13px] leading-tight">
                  <div className="truncate">{role.member.displayName}</div>
                  <div className="text-[11px] font-light text-muted-foreground">{role.label}</div>
                </div>
              </div>
            ))}
          </div>
        ) : null}
        {showList ? (
          <div>
            <button
              type="button"
              onClick={() => setListOpen((open) => !open)}
              className="flex items-center gap-1 text-[12px] font-light text-muted-foreground hover:text-foreground"
            >
              פירוט מלא
              <ChevronDown className={cn("size-3.5 transition", listOpen && "rotate-180")} aria-hidden />
            </button>
            {listOpen ? (
              <ul className="mt-3 space-y-2.5">
                {members.map((member) => (
                  <li key={member.id} className="flex min-w-0 items-center gap-2">
                    <UserAvatar member={member} size="sm" />
                    <span className="min-w-0 truncate text-[13px] font-light">{member.displayName}</span>
                    <span className="ms-auto shrink-0 text-[12px] font-light text-muted-foreground">
                      {rsvpLabel(event.rsvps[member.id] ?? "pending")}
                    </span>
                    <StatusDot status={event.rsvps[member.id] ?? "pending"} />
                  </li>
                ))}
              </ul>
            ) : null}
          </div>
        ) : (
          <p className="text-[12px] font-light text-muted-foreground">
            פירוט מלא גלוי למנהל ולראש החברה.
          </p>
        )}
      </aside>
    </motion.section>
  );
}

function DetailChip({ icon: Icon, children }: { icon: LucideIcon; children: React.ReactNode }) {
  return (
    <span className="inline-flex max-w-full items-center gap-1.5 rounded-full border border-[#e6e9ee] bg-white px-3 py-1.5 text-[13px] font-light text-foreground/85">
      <Icon className="size-3.5 shrink-0 text-primary/70" aria-hidden />
      <span className="truncate">{children}</span>
    </span>
  );
}

function Ring({ value, total }: { value: number; total: number }) {
  const r = 23;
  const c = 2 * Math.PI * r;
  const filled = total ? (value / total) * c : 0;
  return (
    <svg width="56" height="56" viewBox="0 0 56 56" className="shrink-0" aria-hidden>
      <circle cx="28" cy="28" r={r} fill="none" stroke="#e6e7ea" strokeWidth="5" />
      {filled ? (
        <circle
          cx="28"
          cy="28"
          r={r}
          fill="none"
          stroke="#3d8f62"
          strokeWidth="5"
          strokeLinecap="round"
          strokeDasharray={`${filled} ${c}`}
          transform="rotate(-90 28 28)"
        />
      ) : null}
    </svg>
  );
}

function RsvpButton({
  active,
  tone,
  onClick,
  children,
}: {
  active: boolean;
  tone: "yes" | "maybe" | "no";
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "inline-flex flex-1 items-center justify-center gap-1.5 whitespace-nowrap rounded-full border px-3 py-2.5 sm:px-5 text-[14px] font-normal transition sm:flex-none",
        !active && "border-[#dfe3e8] bg-white text-foreground/75 hover:border-[#c9cfd7] hover:text-foreground",
        active && tone === "yes" && "border-[#3d8f62] bg-[#3d8f62] text-white",
        active && tone === "maybe" && "border-[#d9dde3] bg-[#eceff2] text-foreground",
        active && tone === "no" && "border-destructive/25 bg-destructive/8 text-destructive"
      )}
    >
      {children}
    </button>
  );
}

function StatusDot({ status }: { status: RsvpStatus }) {
  return (
    <span
      title={rsvpLabel(status)}
      className={cn(
        "size-1.5 shrink-0 rounded-full",
        status === "yes" && "bg-[#3d8f62]",
        status === "maybe" && "bg-amber-500/80",
        status === "no" && "bg-destructive/70",
        status === "pending" && "bg-black/15"
      )}
    />
  );
}
