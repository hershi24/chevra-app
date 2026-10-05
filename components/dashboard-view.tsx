"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
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
import { CommunityHome } from "@/components/community-home";
import { boardEnabled } from "@/lib/community-board";
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
import { dmName, galleryItems, gatheringHeld, upcomingGathering } from "@/lib/selectors";
import type { Gathering, Member, Message, PublicState, RsvpStatus } from "@/lib/types";
import { cn } from "@/lib/utils";

const SEEN_KEY = "chevra-dashboard-seen";
const CARD =
  "rounded-[1.5rem] border border-[#d5dbe3] bg-[#fbfcfd] shadow-[0_10px_28px_rgba(80,90,105,0.05)]";

export function DashboardView() {
  const { state, me, act } = useApp();
  if (!state || !me) return null;
  if (boardEnabled(state)) return <CommunityHome />;
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
    ? settlement(state.expenses ?? [], state.members.map((m) => m.id), state.payments ?? []).rows.find(
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
    if (!event || (event.rsvps[me.id] ?? "pending") === status) return;
    try {
      await act({ type: "rsvp", eventId: event.id, status });
      toast.success("מצליח");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "שגיאה");
    }
  };

  const canCreate = can(me, "createEvent");
  const quick = [
    {
      href: "/chat",
      icon: MessageCircle,
      title: "צ׳אט",
      sub: newMessages
        ? `${newMessages} הודעות חדשות`
        : latestMessages[0]
          ? formatRelativeHe(latestMessages[0].createdAt)
          : "עוד אין הודעות",
      count: newMessages,
    },
    {
      href: "/gallery",
      icon: Images,
      title: "גלריה",
      sub: newPhotos ? `${newPhotos} חדשות` : gallery.length ? `${gallery.length} פריטים` : "עוד ריקה",
      count: newPhotos,
    },
    {
      href: "/journal",
      icon: BookOpen,
      title: "יומן",
      sub: lastPast?.summary?.trim() ? "סיכום אחרון" : "החברות שהיו",
    },
    ...(showExpenses
      ? [{ href: "/expenses", icon: Receipt, title: "באו חשבון", sub: expenseSub }]
      : []),
  ];

  return (
    <div className="flex flex-col gap-6 md:gap-8">
      <header className="flex items-end justify-between gap-4">
        <div className="min-w-0">
          <p className="text-[13px] font-light text-muted-foreground">
            {greeting()}, {me.displayName.split(" ")[0]}
          </p>
          <h1 className="mt-0.5 text-[1.55rem] font-normal tracking-tight text-foreground md:text-[1.85rem]">
            {headline(event)}
          </h1>
        </div>
        <div className="flex shrink-0 items-center gap-4">
          <p className="hidden text-[13px] font-light text-muted-foreground md:block">
            {weekday(new Date())} · {formatHebrewDate(new Date().toISOString())}
          </p>
          {canCreate ? (
            <EventDialog
              trigger={
                <Button variant="ghost" size="sm" className="rounded-full font-normal text-muted-foreground">
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
          {canCreate ? (
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

      <nav
        className={cn(
          "grid grid-cols-2 gap-px overflow-hidden rounded-[1.25rem] border border-[#dfe3e9] bg-[#e7eaee]",
          quick.length === 4 ? "md:grid-cols-4" : "md:grid-cols-3"
        )}
      >
        {quick.map((item, index) => (
          <QuickLink
            key={item.href}
            {...item}
            className={cn(quick.length % 2 === 1 && index === quick.length - 1 && "col-span-2 md:col-span-1")}
          />
        ))}
      </nav>

      <section
        className={cn(
          "grid grid-cols-1 gap-6 md:gap-8",
          lastWithPhotos && "lg:grid-cols-[1.2fr_1fr]"
        )}
      >
        <div className="min-w-0">
          <SectionHead title="מה חדש בצ׳אט" href="/chat" link="לצ׳אט" />
          {latestMessages.length ? (
            <ul className="divide-y divide-[#e7eaee]">
              {latestMessages.slice(0, 3).map((msg) => {
                const author = memberById(state.members, msg.authorId);
                return (
                  <li key={msg.id}>
                    <Link href="/chat" className="flex items-center gap-3 py-3">
                      <UserAvatar member={author} size="sm" />
                      <div className="min-w-0 flex-1">
                        <div className="flex items-baseline gap-2 text-[13px]">
                          <span className="truncate font-normal">{author?.displayName}</span>
                          <span className="shrink-0 text-[11px] font-light text-muted-foreground">
                            {channelLabel(msg.channelId)}
                          </span>
                          <span className="ms-auto shrink-0 text-[11px] font-light text-muted-foreground">
                            {formatRelativeHe(msg.createdAt)}
                          </span>
                        </div>
                        <p className="font-chat truncate text-[13px] font-normal text-foreground/65">
                          {messagePreview(msg)}
                        </p>
                      </div>
                    </Link>
                  </li>
                );
              })}
            </ul>
          ) : (
            <p className="py-3 text-sm font-light text-muted-foreground">עוד אין הודעות בצ׳אט.</p>
          )}
        </div>

        {lastWithPhotos ? <LastGathering event={lastWithPhotos} /> : null}
      </section>
    </div>
  );
}

function SectionHead({ title, href, link }: { title: string; href: string; link: string }) {
  return (
    <div className="mb-1 flex items-baseline justify-between gap-3">
      <h2 className="text-[15px] font-normal">{title}</h2>
      <Link href={href} className="text-[12px] font-light text-primary/85 hover:text-primary">
        {link} ←
      </Link>
    </div>
  );
}

function QuickLink({
  href,
  icon: Icon,
  title,
  sub,
  count,
  className,
}: {
  href: string;
  icon: LucideIcon;
  title: string;
  sub: string;
  count?: number;
  className?: string;
}) {
  return (
    <Link
      href={href}
      className={cn(
        "flex min-w-0 items-center gap-3 bg-[#fbfcfd] px-4 py-3.5 transition hover:bg-white",
        className
      )}
    >
      <Icon className="size-[18px] shrink-0 text-primary/75" aria-hidden />
      <span className="min-w-0 flex-1">
        <span className="flex items-center gap-1.5 text-[14px] font-normal">
          {title}
          {count ? <span className="size-1.5 rounded-full bg-primary" aria-hidden /> : null}
        </span>
        <span className="block truncate text-[12px] font-light text-muted-foreground">{sub}</span>
      </span>
    </Link>
  );
}

function LastGathering({ event }: { event: Gathering }) {
  const media = event.media.filter((i) => i.type === "image" || i.type === "video");
  const shown = media.slice(0, 3);
  const extra = media.length - 3;
  const summary = event.summary?.trim();

  return (
    <div className="min-w-0">
      <SectionHead title="מהחברה האחרונה" href="/gallery" link="לגלריה" />
      <div className="mt-2 grid grid-cols-3 gap-1.5">
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
            {index === 2 && extra > 0 ? (
              <span className="absolute inset-0 grid place-items-center bg-black/35 text-base text-white">
                +{extra}
              </span>
            ) : null}
          </Link>
        ))}
      </div>
      {summary ? (
        <p className="mt-3 line-clamp-2 text-[13px] font-light leading-6 text-foreground/65">{summary}</p>
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
  const held = gatheringHeld(event);
  const mine = event.rsvps[me.id] ?? "pending";
  const coming = members.filter((m) => event.rsvps[m.id] === "yes");
  const maybe = members.filter((m) => event.rsvps[m.id] === "maybe");
  const pending = members.filter((m) => (event.rsvps[m.id] ?? "pending") === "pending");
  const showList = can(me, "viewRsvps");
  const title = gatheringTitle(event);
  const topic = event.topic?.trim() || null;
  const heading = topic || title || "החברה הבאה";
  const sub = topic && title ? title : null;
  const date = new Intl.DateTimeFormat("he-IL", { day: "numeric", month: "long" }).format(
    new Date(event.startsAt)
  );
  const details = [
    event.location ? { icon: MapPin, text: event.location } : null,
    host ? { icon: Home, text: `אצל ${host.displayName}` } : null,
    kibud ? { icon: UtensilsCrossed, text: `כיבוד: ${kibud.displayName}` } : null,
    lecturer ? { icon: BookOpen, text: `שיעור: ${lecturer.displayName}` } : null,
  ].filter((d): d is { icon: LucideIcon; text: string } => Boolean(d));

  return (
    <section className={cn(CARD, "grid min-w-0 overflow-hidden md:grid-cols-[1fr_15rem]")}>
      <div className="relative min-w-0 px-5 py-6 md:px-8 md:py-8">
        {can(me, "editEvent") ? (
          <div className="absolute end-3 top-3 md:end-5 md:top-5">
            <EventDialog
              event={event}
              trigger={
                <Button
                  type="button"
                  variant="ghost"
                  size="icon-sm"
                  className="rounded-full text-muted-foreground"
                  aria-label="עריכה"
                >
                  <Pencil />
                </Button>
              }
            />
          </div>
        ) : null}

        <p className="text-[12px] font-light text-primary/85">
          {weekday(event.startsAt)} · {date} · {formatTimeHe(event.startsAt)}
        </p>
        <h2 className="mt-1.5 pe-8 text-[1.5rem] font-normal leading-tight tracking-tight md:text-[1.9rem]">
          {heading}
        </h2>
        <p className="mt-1 text-[13px] font-light text-muted-foreground">
          {formatHebrewDate(event.startsAt)}
          {sub ? ` · ${sub}` : ""}
        </p>

        {details.length ? (
          <ul className="mt-5 flex flex-col gap-1.5 text-[14px] font-light text-foreground/75 sm:flex-row sm:flex-wrap sm:gap-x-5">
            {details.map((d) => (
              <li key={d.text} className="flex min-w-0 items-center gap-2">
                <d.icon className="size-4 shrink-0 text-primary/60" aria-hidden />
                <span className="truncate">{d.text}</span>
              </li>
            ))}
          </ul>
        ) : null}

        <div className="mt-6 flex flex-col gap-5 border-t border-[#eceef1] pt-5 sm:flex-row sm:items-center sm:justify-between">
          <Countdown iso={event.startsAt} />
          {held ? (
            <p className="max-w-sm text-[13px] font-light leading-6 text-foreground/75">
              התקיימה
              {coming.length
                ? ` · השתתפו: ${coming.map((member) => member.displayName).join(", ")}`
                : " · אף אחד לא אישר הגעה"}
            </p>
          ) : (
            <div
              role="group"
              aria-label="אישור הגעה"
              className="flex rounded-full bg-[#eef0f3] p-1"
            >
              <RsvpButton active={mine === "yes"} tone="yes" onClick={() => void onRsvp("yes")}>
                {mine === "yes" ? <Check className="size-3.5" aria-hidden /> : null}
                מגיע
              </RsvpButton>
              <RsvpButton active={mine === "maybe"} tone="maybe" onClick={() => void onRsvp("maybe")}>
                אולי
              </RsvpButton>
              <RsvpButton active={mine === "no"} tone="no" onClick={() => void onRsvp("no")}>
                לא אוכל
              </RsvpButton>
            </div>
          )}
        </div>
      </div>

      <aside className="flex min-w-0 flex-col justify-center border-t border-[#eceef1] px-5 py-5 md:border-s md:border-t-0 md:px-6 md:py-8">
        <div className="flex items-center gap-3 md:flex-col md:items-start md:gap-4">
          <div className="flex items-center gap-3">
            <Ring value={coming.length} total={members.length} />
            <div>
              <div className="text-[15px] leading-tight">
                {coming.length} {held ? "השתתפו" : "מגיעים"}
                <span className="text-[12px] font-light text-muted-foreground"> מתוך {members.length}</span>
              </div>
              {held ? null : (
                <div className="mt-0.5 text-[12px] font-light text-muted-foreground">
                  {maybe.length} אולי · {pending.length} לא ענו
                </div>
              )}
            </div>
          </div>
          {coming.length ? (
            <div className="ms-auto flex -space-x-2 space-x-reverse md:ms-0">
              {coming.slice(0, 6).map((member) => (
                <UserAvatar key={member.id} member={member} size="sm" className="ring-2 ring-[#fbfcfd]" />
              ))}
            </div>
          ) : null}
        </div>
        {showList && !held ? (
          <div className="mt-4">
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
        ) : null}
      </aside>
    </section>
  );
}

function Ring({ value, total }: { value: number; total: number }) {
  const r = 18;
  const c = 2 * Math.PI * r;
  const filled = total ? (value / total) * c : 0;
  return (
    <svg width="44" height="44" viewBox="0 0 44 44" className="shrink-0" aria-hidden>
      <circle cx="22" cy="22" r={r} fill="none" stroke="#e8eaed" strokeWidth="4" />
      {filled ? (
        <circle
          cx="22"
          cy="22"
          r={r}
          fill="none"
          stroke="#3d8f62"
          strokeWidth="4"
          strokeLinecap="round"
          strokeDasharray={`${filled} ${c}`}
          transform="rotate(-90 22 22)"
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
      aria-pressed={active}
      onClick={onClick}
      className={cn(
        "inline-flex flex-1 items-center justify-center gap-1 whitespace-nowrap rounded-full px-4 py-1.5 text-[13px] font-normal sm:flex-none",
        !active && "text-foreground/65 hover:text-foreground",
        active && tone === "yes" && "bg-[#3d8f62] text-white",
        active && tone === "maybe" && "bg-white text-foreground shadow-[0_1px_2px_rgba(0,0,0,0.06)]",
        active && tone === "no" && "bg-white text-destructive shadow-[0_1px_2px_rgba(0,0,0,0.06)]"
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
