"use client";

import { useState } from "react";
import Link from "next/link";
import { Check, Mic, Pencil, Plus, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { EventDialog } from "@/components/event-dialog";
import { UserAvatar } from "@/components/user-avatar";
import {
  formatDayMonth,
  formatTimeHe,
  gatheringLabel,
  hebrewDateParts,
  memberById,
  splitGatheringTitle,
} from "@/lib/format";
import { can, isAdmin } from "@/lib/permissions";
import type { Gathering, Member } from "@/lib/types";
import { useApp } from "@/components/app-provider";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

const weekday = new Intl.DateTimeFormat("he-IL", { weekday: "long" });

function images(event: Gathering) {
  return event.media.filter((m) => m.type === "image");
}

function Chip({ children, tone = "gold" }: { children: React.ReactNode; tone?: "gold" | "gray" }) {
  return (
    <span
      className={cn(
        "inline-flex items-center rounded-full px-2.5 py-0.5 text-[12px] font-light",
        tone === "gold" ? "bg-[#f7eedd] text-[#7a5418]" : "bg-[#eef0f3] text-[#4b5563]"
      )}
    >
      {children}
    </span>
  );
}

function groupByMonth(events: Gathering[]) {
  const groups: { key: string; items: Gathering[] }[] = [];
  for (const event of events) {
    const { month, year } = hebrewDateParts(event.startsAt);
    const key = `${month} ${year}`;
    const last = groups[groups.length - 1];
    if (last?.key === key) last.items.push(event);
    else groups.push({ key, items: [event] });
  }
  return groups;
}

export function JournalView() {
  const { state, me, act } = useApp();
  const [confirmId, setConfirmId] = useState<string | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [rsvping, setRsvping] = useState(false);
  if (!state || !me) return null;
  const user = me;

  const upcoming = state.gatherings
    .filter((g) => g.status === "upcoming")
    .sort((a, b) => +new Date(a.startsAt) - +new Date(b.startsAt));
  const past = state.gatherings
    .filter((g) => g.status !== "upcoming")
    .sort((a, b) => +new Date(b.startsAt) - +new Date(a.startsAt));
  const next = upcoming[0];
  const bandImages = [...state.gatherings]
    .sort((a, b) => +new Date(b.startsAt) - +new Date(a.startsAt))
    .flatMap((g) => images(g).slice(0, 2))
    .slice(0, 4);
  const trips = state.gatherings.filter((g) => gatheringLabel(g).includes("טיול")).length;
  const photoCount = state.gatherings.reduce((sum, g) => sum + images(g).length, 0);
  const count = (n: number, one: string, many: string) => (n === 1 ? one : `${n} ${many}`);
  const stats = [
    past.length ? count(past.length, "חברה אחת", "חברות") : null,
    trips ? count(trips, "טיול אחד", "טיולים") : null,
    photoCount ? count(photoCount, "תמונה אחת", "תמונות") : null,
  ].filter(Boolean);

  const confirm = state.gatherings.find((event) => event.id === confirmId) ?? null;

  async function removeGathering() {
    if (!confirm || deleting) return;
    setDeleting(true);
    try {
      await act({ type: "deleteGathering", eventId: confirm.id });
      setConfirmId(null);
      toast.success("החברה נמחקה");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "המחיקה נכשלה");
    } finally {
      setDeleting(false);
    }
  }

  async function comeTo(event: Gathering) {
    if (rsvping) return;
    setRsvping(true);
    try {
      await act({ type: "rsvp", eventId: event.id, status: "yes" });
      toast.success("נרשמת כמגיע");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "השמירה נכשלה");
    } finally {
      setRsvping(false);
    }
  }

  function entry(event: Gathering) {
    return (
      <JournalEntry
        key={event.id}
        event={event}
        members={state!.members}
        canEdit={can(user, "editEvent")}
        canDelete={isAdmin(user)}
        onDelete={() => setConfirmId(event.id)}
      />
    );
  }

  return (
    <div className="mx-auto max-w-6xl">
      <section className="relative overflow-hidden rounded-[26px] md:h-[190px]">
        <div className="grid h-[120px] grid-cols-4 md:absolute md:inset-y-0 md:left-0 md:h-full md:w-[66%]">
          {bandImages.map((image) => (
            // eslint-disable-next-line @next/next/no-img-element
            <img key={image.id} src={image.url} alt="" className="h-full w-full object-cover" />
          ))}
        </div>
        <div className="pointer-events-none absolute inset-x-0 top-0 h-[120px] bg-linear-to-t from-background to-transparent to-70% md:inset-0 md:h-auto md:bg-linear-to-l md:from-background md:via-background/90 md:via-38% md:to-transparent md:to-75%" />
        <div className="relative -mt-6 flex flex-col justify-center md:absolute md:inset-y-0 md:right-0 md:mt-0 md:px-[34px]">
          <h1 className="text-[1.75rem] font-medium tracking-tight md:text-[2rem]">יומן החבורה</h1>
          <p className="mt-1 text-[14px] font-light text-[#4b5563]">{stats.join(" · ")}</p>
          <div className="mt-3.5 flex flex-wrap items-center gap-2.5 text-[13px]">
            {next ? (
              <>
                <Link
                  href={`/journal/${next.id}`}
                  className="rounded-full bg-white/85 px-3 py-1.5 font-light text-[#1f2328] shadow-[0_1px_2px_rgba(15,23,42,.06)] ring-1 ring-[#ecdcbc]"
                >
                  הבאה: {weekday.format(new Date(next.startsAt))} {formatDayMonth(next.startsAt)} ·{" "}
                  {formatTimeHe(next.startsAt)} · {splitGatheringTitle(next).heading}
                  {memberById(state.members, next.hostId)
                    ? ` אצל ${memberById(state.members, next.hostId)!.displayName}`
                    : ""}
                </Link>
                {can(me, "rsvp") ? (
                  next.rsvps[me.id] === "yes" ? (
                    <span className="inline-flex items-center gap-1 rounded-full bg-[#eaf5ee] px-3 py-1.5 text-[#256b43]">
                      <Check className="size-3.5" />
                      אתה מגיע
                    </span>
                  ) : (
                    <Button
                      type="button"
                      size="sm"
                      className="rounded-full px-4"
                      disabled={rsvping}
                      onClick={() => void comeTo(next)}
                    >
                      אני מגיע
                    </Button>
                  )
                ) : null}
              </>
            ) : null}
            {can(me, "createEvent") ? (
              <EventDialog
                trigger={
                  <Button type="button" variant="outline" size="sm" className="rounded-full bg-white/80">
                    <Plus data-icon="inline-start" />
                    חברה חדשה
                  </Button>
                }
              />
            ) : null}
          </div>
        </div>
      </section>

      <div className="relative mt-8 md:pr-[110px]">
        <div className="absolute top-2 bottom-0 right-[86px] hidden w-0.5 bg-linear-to-b from-[#e6d3ad] to-[#eef0f3] md:block" />
        {upcoming.length ? (
          <>
            <MonthLabel>בקרוב</MonthLabel>
            {upcoming.map(entry)}
          </>
        ) : null}
        {groupByMonth(past).map((group) => (
          <div key={group.key}>
            <MonthLabel>{group.key}</MonthLabel>
            {group.items.map(entry)}
          </div>
        ))}
        {state.gatherings.length === 0 ? (
          <p className="py-10 text-center font-light text-muted-foreground">עדיין אין חברות ביומן.</p>
        ) : null}
      </div>

      {confirm ? (
        <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/45 p-4 md:items-center">
          <div role="dialog" aria-modal="true" className="w-full max-w-md rounded-2xl bg-white p-4 shadow-2xl">
            <h2 className="text-base font-medium">למחוק את החברה?</h2>
            <p className="mt-1 text-sm font-light leading-6 text-muted-foreground">
              {gatheringLabel(confirm)} תוסר מהיומן. המדיה בגלריה נשארת.
            </p>
            <div className="mt-4 flex gap-2">
              <Button
                type="button"
                variant="destructive"
                className="h-11 flex-1 rounded-xl"
                disabled={deleting}
                onClick={() => void removeGathering()}
              >
                {deleting ? "מוחק…" : "מחק"}
              </Button>
              <Button
                type="button"
                variant="outline"
                className="h-11 flex-1 rounded-xl"
                disabled={deleting}
                onClick={() => setConfirmId(null)}
              >
                ביטול
              </Button>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}

function MonthLabel({ children }: { children: React.ReactNode }) {
  return (
    <div className="relative mt-1.5 mb-3 text-[13px] font-medium text-[#8a5f1c]">
      <span className="absolute -right-[30px] top-[3px] hidden size-3 rounded-full border-2 border-[#b8862f] bg-white md:block" />
      {children}
    </div>
  );
}

function JournalEntry({
  event,
  members,
  canEdit,
  canDelete,
  onDelete,
}: {
  event: Gathering;
  members: Member[];
  canEdit: boolean;
  canDelete: boolean;
  onDelete: () => void;
}) {
  const href = `/journal/${event.id}`;
  const { kind, heading } = splitGatheringTitle(event);
  const { day, month } = hebrewDateParts(event.startsAt);
  const isUpcoming = event.status === "upcoming";
  const host = memberById(members, event.hostId);
  const lecturer = memberById(members, event.lecturerId);
  const kibud = memberById(members, event.kibudId);
  const yes = members.filter((m) => event.rsvps[m.id] === "yes");
  const pics = images(event);
  const text = isUpcoming ? event.topic || event.notes : event.summary || event.topic;
  const facts = [
    yes.length
      ? isUpcoming
        ? `${yes.length} מגיעים`
        : yes.length === members.length
          ? `כל ${members.length} החברים הגיעו`
          : `${yes.length} השתתפו`
      : null,
    pics.length ? `${pics.length} תמונות` : null,
  ].filter(Boolean);

  return (
    <article
      className={cn(
        "relative mb-[18px] grid gap-4 rounded-[22px] p-4 shadow-[0_1px_2px_rgba(15,23,42,.04),0_8px_22px_rgba(15,23,42,.04)] md:gap-5 md:px-5 md:py-[18px]",
        pics.length ? "md:grid-cols-[1fr_300px]" : "",
        isUpcoming ? "bg-[#fffaf0] ring-1 ring-[#ecdcbc]" : "bg-white"
      )}
    >
      <div className="absolute -right-[110px] top-3.5 hidden w-16 text-center md:block">
        <b className={cn("block text-[26px] leading-none font-medium", isUpcoming && "text-[#8a5f1c]")}>{day}</b>
        <span className="text-[11px] font-light text-muted-foreground">
          {month} · {formatDayMonth(event.startsAt)}
        </span>
      </div>
      <div className="min-w-0">
        <div className="flex flex-wrap items-center gap-1.5">
          <span className="text-[12px] font-light text-[#8a5f1c] md:hidden">
            {day} ב{month} · {formatDayMonth(event.startsAt)} ·
          </span>
          {kind ? <Chip tone="gray">{kind}</Chip> : null}
          {isUpcoming ? <Chip>קרובה · {formatTimeHe(event.startsAt)}</Chip> : null}
          {event.status === "cancelled" ? <Chip tone="gray">בוטלה</Chip> : null}
        </div>
        <h3 className="mt-1.5 mb-1 text-[18px] leading-snug font-medium">
          <Link href={href} className="after:absolute after:inset-0 after:rounded-[22px]">
            {heading}
          </Link>
        </h3>
        <div className="flex flex-wrap gap-1.5">
          {host ? <Chip>מארח: {host.displayName}</Chip> : null}
          {lecturer ? <Chip>שיעור: {lecturer.displayName}</Chip> : null}
          {kibud ? <Chip>כיבוד: {kibud.displayName}</Chip> : null}
        </div>
        {text ? (
          <p className="mt-2 mb-3 line-clamp-2 text-[13.5px] leading-[1.75] font-light text-[#4b5563]">{text}</p>
        ) : (
          <div className="h-3" />
        )}
        <div className="flex flex-wrap items-center gap-2.5 text-[12px] font-light text-muted-foreground">
          {yes.length ? (
            <span className="flex -space-x-1.5">
              {yes.slice(0, 5).map((m) => (
                <UserAvatar key={m.id} member={m} size="sm" className="ring-2 ring-white" />
              ))}
            </span>
          ) : null}
          <span>{facts.join(" · ")}</span>
          {event.audioUrl ? (
            <span className="inline-flex items-center gap-1">
              <Mic className="size-3.5" />
              הקלטת שיעור
            </span>
          ) : null}
          {canEdit || canDelete ? (
            <span className="relative z-10 ms-auto flex gap-0.5">
              {canEdit ? (
                <EventDialog
                  event={event}
                  trigger={
                    <Button type="button" variant="ghost" size="xs">
                      <Pencil data-icon="inline-start" />
                      עריכה
                    </Button>
                  }
                />
              ) : null}
              {canDelete ? (
                <Button
                  type="button"
                  variant="ghost"
                  size="xs"
                  className="text-destructive hover:bg-destructive/10 hover:text-destructive"
                  onClick={onDelete}
                >
                  <Trash2 data-icon="inline-start" />
                  מחק
                </Button>
              ) : null}
            </span>
          ) : null}
        </div>
      </div>
      {pics.length ? (
        <div
          className={cn(
            "pointer-events-none grid h-[170px] gap-1.5",
            pics.length === 1 ? "grid-cols-1" : "grid-cols-[2fr_1fr]",
            pics.length > 2 && "grid-rows-2"
          )}
        >
          {pics.slice(0, 3).map((image, index) => (
            <div
              key={image.id}
              className={cn("relative overflow-hidden rounded-[14px]", index === 0 && pics.length > 2 && "row-span-2")}
            >
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={image.url} alt="" className="h-full w-full object-cover" />
              {index === 2 && pics.length > 3 ? (
                <span className="absolute inset-0 grid place-items-center bg-black/45 text-[15px] text-white">
                  +{pics.length - 3}
                </span>
              ) : null}
            </div>
          ))}
        </div>
      ) : null}
    </article>
  );
}
