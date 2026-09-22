"use client";

import Link from "next/link";
import { motion } from "framer-motion";
import { BookOpen, Home, MapPin, Plus, UtensilsCrossed } from "lucide-react";
import { toast } from "sonner";
import { useApp } from "@/components/app-provider";
import { Countdown } from "@/components/countdown";
import { EventDialog } from "@/components/event-dialog";
import { UserAvatar } from "@/components/user-avatar";
import { Button } from "@/components/ui/button";
import {
  formatDateHe,
  formatTimeHe,
  gatheringTitle,
  memberById,
  rsvpLabel,
} from "@/lib/format";
import { can } from "@/lib/permissions";
import { upcomingGathering } from "@/lib/selectors";
import type { Gathering, Member, RsvpStatus } from "@/lib/types";
import { cn } from "@/lib/utils";

export function DashboardView() {
  const { state, me, act } = useApp();
  if (!state || !me) return null;

  const event = upcomingGathering(state);
  const latestMessages = [...state.messages]
    .sort((a, b) => +new Date(b.createdAt) - +new Date(a.createdAt))
    .slice(0, 4);

  return (
    <div className="mx-auto flex max-w-5xl flex-col gap-10 md:gap-14">
      <header className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="text-[13px] font-light text-muted-foreground">
            שלום {me.displayName.split(" ")[0]}
          </p>
          <h1 className="mt-1 text-[1.65rem] font-medium tracking-tight text-foreground md:text-[2rem]">
            המפגש הבא
          </h1>
        </div>
        {can(me, "createEvent") ? (
          <EventDialog
            trigger={
              <Button variant="ghost" className="rounded-full px-4 font-normal">
                <Plus data-icon="inline-start" />
                מפגש חדש
              </Button>
            }
          />
        ) : null}
      </header>

      {event ? (
        <HeroEvent
          event={event}
          members={state.members}
          me={me}
          onRsvp={async (status) => {
            try {
              await act({ type: "rsvp", eventId: event.id, status });
              toast.success("ההגעה עודכנה");
            } catch (error) {
              toast.error(error instanceof Error ? error.message : "שגיאה");
            }
          }}
        />
      ) : (
        <section className="paper-card rounded-[1.75rem] px-6 py-12">
          <p className="text-muted-foreground">אין מפגש קרוב ביומן כרגע.</p>
          {can(me, "createEvent") ? (
            <div className="mt-4">
              <EventDialog trigger={<Button variant="outline" className="rounded-full">קביעת מפגש</Button>} />
            </div>
          ) : (
            <p className="mt-2 text-sm font-light text-muted-foreground">
              כשמנהל המערכת יקבע מפגש — הוא יופיע כאן.
            </p>
          )}
        </section>
      )}

      <section>
        <div className="mb-5 flex items-baseline gap-3">
          <h2 className="text-sm font-normal text-muted-foreground">מה חדש</h2>
          <Link href="/chat" className="text-sm font-light text-primary/80 hover:text-primary">
            הצ׳אט
          </Link>
        </div>
        <div className="grid grid-cols-1 gap-5 sm:grid-cols-2">
          {latestMessages.map((msg) => {
            const author = memberById(state.members, msg.authorId);
            return (
              <Link key={msg.id} href="/chat" className="flex gap-3">
                <UserAvatar member={author} size="sm" />
                <div className="min-w-0">
                  <div className="text-[13px] font-normal">{author?.displayName}</div>
                  <p className="line-clamp-2 text-[13px] font-light leading-6 text-muted-foreground">
                    {msg.text}
                  </p>
                </div>
              </Link>
            );
          })}
        </div>
      </section>
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
  const host = memberById(members, event.hostId);
  const kibud = memberById(members, event.kibudId);
  const lecturer = memberById(members, event.lecturerId);
  const mine = event.rsvps[me.id] ?? "pending";
  const coming = members.filter((m) => event.rsvps[m.id] === "yes");
  const showList = can(me, "viewRsvps");
  const title = gatheringTitle(event);
  const topic = event.topic?.trim() || null;
  const heading = topic || title;
  const sub = topic && title ? title : null;

  return (
    <motion.section
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.45, ease: "easeOut" }}
      className="paper-card grid min-w-0 gap-8 rounded-[1.75rem] px-5 py-7 md:px-10 md:py-10 lg:grid-cols-[1fr_15.5rem] lg:gap-12"
    >
      <div className="min-w-0 space-y-7">
        <div>
          <p className="text-[12px] font-light tracking-[0.14em] text-muted-foreground">
            {formatDateHe(event.startsAt)} · {formatTimeHe(event.startsAt)}
          </p>
          {heading ? (
            <h2 className="mt-3 text-[1.85rem] font-medium leading-tight tracking-tight md:text-[2.15rem]">
              {heading}
            </h2>
          ) : null}
          {sub ? (
            <p className="mt-2 text-sm font-light text-muted-foreground">{sub}</p>
          ) : null}
        </div>

        <div className="max-w-xl space-y-2 text-[15px] font-light leading-7 text-foreground/80">
          {event.location ? (
            <p className="flex items-start gap-2.5">
              <MapPin className="mt-1 size-4 shrink-0 text-primary" aria-hidden />
              <span>{event.location}</span>
            </p>
          ) : null}
          {host ? (
            <p className="flex items-start gap-2.5">
              <Home className="mt-1 size-4 shrink-0 text-primary" aria-hidden />
              <span>אצל {host.displayName}</span>
            </p>
          ) : null}
          {kibud ? (
            <p className="flex items-start gap-2.5">
              <UtensilsCrossed className="mt-1 size-4 shrink-0 text-primary" aria-hidden />
              <span>כיבוד: {kibud.displayName}</span>
            </p>
          ) : null}
          {lecturer ? (
            <p className="flex items-start gap-2.5">
              <BookOpen className="mt-1 size-4 shrink-0 text-primary" aria-hidden />
              <span>השיעור: {lecturer.displayName}</span>
            </p>
          ) : null}
        </div>

        <Countdown iso={event.startsAt} />

        <div className="flex flex-wrap items-center gap-2 pt-1">
          <RsvpPill active={mine === "yes"} onClick={() => void onRsvp("yes")}>
            מאשר הגעה
          </RsvpPill>
          <RsvpPill active={mine === "maybe"} tone="soft" onClick={() => void onRsvp("maybe")}>
            אולי
          </RsvpPill>
          <RsvpPill active={mine === "no"} tone="quiet" onClick={() => void onRsvp("no")}>
            לא אוכל
          </RsvpPill>
        </div>
      </div>

      <div className="min-w-0 border-t border-black/6 pt-6 lg:border-t-0 lg:border-s lg:pt-0 lg:ps-8">
        <div className="flex items-baseline justify-between gap-3">
          <h3 className="text-sm font-normal text-muted-foreground">מי מגיע</h3>
          <span className="text-[13px] font-light text-muted-foreground">{coming.length} אישרו</span>
        </div>
        <div className="mt-4 flex -space-x-2 space-x-reverse">
          {coming.slice(0, 8).map((member) => (
            <UserAvatar key={member.id} member={member} />
          ))}
        </div>
        {showList ? (
          <ul className="mt-6 space-y-2.5">
            {members.map((member) => (
              <li key={member.id} className="flex min-w-0 items-center gap-2">
                <UserAvatar member={member} size="sm" />
                <span className="min-w-0 truncate text-[13px] font-light">
                  {member.displayName}
                </span>
                <StatusDot status={event.rsvps[member.id] ?? "pending"} />
              </li>
            ))}
          </ul>
        ) : (
          <p className="mt-4 text-[12px] font-light text-muted-foreground">
            פירוט מלא גלוי למנהל ולמגיד השיעור.
          </p>
        )}
      </div>
    </motion.section>
  );
}

function RsvpPill({
  active,
  tone = "primary",
  onClick,
  children,
}: {
  active: boolean;
  tone?: "primary" | "soft" | "quiet";
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "rounded-full px-4 py-2 text-[13px] font-normal transition",
        active && tone === "primary" && "bg-primary text-primary-foreground",
        active && tone === "soft" && "bg-foreground/8 text-foreground",
        active && tone === "quiet" && "bg-destructive/10 text-destructive",
        !active && "text-muted-foreground hover:bg-black/4 hover:text-foreground"
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
        status === "yes" && "bg-primary",
        status === "maybe" && "bg-amber-500/80",
        status === "no" && "bg-destructive/70",
        status === "pending" && "bg-black/15"
      )}
    />
  );
}
