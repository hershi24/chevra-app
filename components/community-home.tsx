"use client";

import { useState } from "react";
import { Clock, FileText, MapPin } from "lucide-react";
import { toast } from "sonner";
import { useApp } from "@/components/app-provider";
import { UserAvatar } from "@/components/user-avatar";
import { resolveBoard } from "@/lib/community-board";
import { formatHebrewDate, formatTimeHe, gatheringLabel, memberById } from "@/lib/format";
import { upcomingGathering } from "@/lib/selectors";
import { cn } from "@/lib/utils";

const CARD = "rounded-[1.5rem] border border-[#d5dbe3] bg-[#fbfcfd] shadow-[0_10px_28px_rgba(80,90,105,0.05)]";

const FALLBACK_PHOTOS = [
  { src: "/board/library.jpg", caption: "ארון ספרים" },
  { src: "/board/shelves.jpg", caption: "ספרייה" },
];

export function CommunityHome() {
  const { state, me, act } = useApp();
  const [pick, setPick] = useState<string | null>(null);
  if (!state || !me) return null;

  const board = resolveBoard(state);
  const next = upcomingGathering(state);
  const more = state.gatherings
    .filter(
      (event) =>
        event.status === "upcoming" &&
        event.id !== next?.id &&
        new Date(event.startsAt).getTime() >= Date.now() - 3 * 3600_000
    )
    .sort((a, b) => +new Date(a.startsAt) - +new Date(b.startsAt))
    .slice(0, 3);
  const leader = state.members.find((member) => member.role === "leader");
  const notices = board.notices;
  const selected = board.photoIds
    .map((id) => {
      for (const event of state.gatherings) {
        const media = event.media.find((item) => item.id === id && item.type === "image");
        if (media) return { src: media.url, caption: media.caption?.trim() || gatheringLabel(event) };
      }
      const loose = (state.gallery ?? []).find((item) => item.id === id && item.type === "image");
      return loose ? { src: loose.url, caption: loose.caption?.trim() || "מהחבורה" } : null;
    })
    .filter((item): item is { src: string; caption: string } => Boolean(item));
  const photos = selected.length ? selected : FALLBACK_PHOTOS;
  const host = next ? memberById(state.members, next.hostId) : null;
  const mine = pick ?? board.poll.options.find((option) => option.voterIds.includes(me.id))?.id ?? null;

  async function vote(optionId: string) {
    if (board.poll.closed || mine === optionId) return;
    setPick(optionId);
    try {
      await act({ type: "voteCommunityPoll", optionId });
      toast.success("ההצבעה נשמרה");
    } catch (error) {
      setPick(null);
      toast.error(error instanceof Error ? error.message : "ההצבעה נכשלה");
    }
  }

  return (
    <div className="flex flex-col gap-8 md:gap-10">
      <header className="flex items-end justify-between gap-4">
        <div>
          <p className="text-[13px] font-light text-muted-foreground">{state.settings.groupName}</p>
          <h1 className="mt-0.5 text-[1.7rem] font-medium tracking-tight md:text-[2.1rem]">לוח החבורה</h1>
        </div>
        {leader ? (
          <div className="flex items-center gap-2.5">
            <div className="text-end">
              <div className="text-[11px] font-light text-muted-foreground">ראש החבורה</div>
              <div className="text-[14px]">{leader.displayName}</div>
            </div>
            <UserAvatar member={leader} />
          </div>
        ) : null}
      </header>

      <section className={cn(CARD, "overflow-hidden")}>
        <div className="grid gap-0 md:grid-cols-[minmax(0,1.3fr)_minmax(18rem,0.9fr)]">
          <div className="px-5 py-6 md:px-8 md:py-8">
            <p className="text-[12px] font-light tracking-wide text-primary">ההתכנסות הקרובה</p>
            {next ? (
              <>
                <h2 className="mt-2 text-[1.7rem] leading-tight font-medium md:text-[2.2rem]">
                  {gatheringLabel(next)}
                </h2>
                <p className="mt-3 text-[1.35rem] font-medium tabular-nums text-primary md:text-[1.7rem]">
                  {formatTimeHe(next.startsAt)}
                </p>
                <p className="mt-1 text-[15px] font-light text-[#3f4650]">{formatHebrewDate(next.startsAt)}</p>
                <div className="mt-4 flex flex-wrap gap-x-5 gap-y-1 text-[14px] font-light text-[#4b5563]">
                  {next.location ? (
                    <span className="inline-flex items-center gap-1.5">
                      <MapPin className="size-3.5 text-primary" />
                      {next.location}
                    </span>
                  ) : null}
                  {host ? <span>מארח: {host.displayName}</span> : null}
                </div>
              </>
            ) : (
              <h2 className="mt-2 text-[1.5rem] font-medium">אין התכנסות קרובה ביומן</h2>
            )}
            {more.length ? (
              <ul className="mt-5 space-y-1.5 border-t border-[#e9ecef] pt-4 text-[14px] font-light text-[#3f4650]">
                {more.map((event) => (
                  <li key={event.id} className="flex items-center justify-between gap-3">
                    <span className="truncate">{gatheringLabel(event)}</span>
                    <span className="shrink-0 tabular-nums text-muted-foreground">
                      {formatTimeHe(event.startsAt)}
                    </span>
                  </li>
                ))}
              </ul>
            ) : null}
          </div>
          <div className="grid grid-cols-2 gap-px bg-[#e9ecef] md:grid-cols-1">
            {board.prayers.map((prayer) => (
              <div key={prayer.id} className="bg-[#fbfcfd] px-5 py-4">
                <div className="flex items-center gap-1.5 text-[12px] font-light text-muted-foreground">
                  <Clock className="size-3.5" />
                  {prayer.name}
                </div>
                <div className="mt-1 text-[1.45rem] font-medium tabular-nums">{prayer.time}</div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {notices.length ? (
        <section>
          <h2 className="mb-3 text-[1.15rem] font-medium">מודעות</h2>
          <div className="grid gap-3 md:grid-cols-2">
            {notices.map((notice) => (
              <article key={notice.id} className={cn(CARD, "px-5 py-4")}>
                <h3 className="text-[16px]">{notice.title}</h3>
                {notice.body ? (
                  <p className="mt-1.5 text-[14px] font-light leading-7 text-[#3f4650]">{notice.body}</p>
                ) : null}
              </article>
            ))}
          </div>
        </section>
      ) : null}

      {board.files.length ? (
        <section>
          <h2 className="mb-3 text-[1.15rem] font-medium">דפי לימוד</h2>
          <div className="grid gap-4">
            {board.files.map((file) => (
              <article key={file.id} className={cn(CARD, "overflow-hidden")}>
                <div className="flex items-center justify-between gap-3 px-5 py-3">
                  <h3 className="inline-flex items-center gap-2 text-[15px]">
                    <FileText className="size-4 text-primary" />
                    {file.title}
                  </h3>
                  <a href={file.url} target="_blank" rel="noreferrer" className="text-[13px] font-light text-primary">
                    פתיחה
                  </a>
                </div>
                <iframe title={file.title} src={file.url} className="h-[420px] w-full border-t border-[#e9ecef] bg-white md:h-[520px]" />
              </article>
            ))}
          </div>
        </section>
      ) : null}

      <section>
        <h2 className="mb-3 text-[1.15rem] font-medium">תמונות מהחבורה</h2>
        <div className="grid grid-cols-2 gap-3 md:grid-cols-3">
          {photos.map((photo) => (
            <figure key={photo.src} className={cn(CARD, "overflow-hidden")}>
              <img src={photo.src} alt={photo.caption} className="aspect-[4/3] w-full object-cover" />
              <figcaption className="px-3 py-2 text-[13px] font-light text-[#3f4650]">{photo.caption}</figcaption>
            </figure>
          ))}
        </div>
      </section>

      <section className={cn(CARD, "px-5 py-5 md:px-7")}>
        <h2 className="text-[1.15rem] font-medium">סקר</h2>
        <p className="mt-1 text-[16px]">{board.poll.question}</p>
        <div className="mt-4 grid gap-2">
          {board.poll.options.map((option) => {
            const count =
              option.voterIds.filter((id) => id && id !== me.id).length + (mine === option.id ? 1 : 0);
            const total = Math.max(
              1,
              board.poll.options.reduce((sum, item) => {
                const votes = item.voterIds.filter((id) => id && id !== me.id).length + (mine === item.id ? 1 : 0);
                return sum + votes;
              }, 0)
            );
            const on = mine === option.id;
            return (
              <button
                key={option.id}
                type="button"
                disabled={board.poll.closed}
                onClick={() => void vote(option.id)}
                className={cn(
                  "relative overflow-hidden rounded-2xl border px-4 py-3 text-start transition",
                  on ? "border-primary bg-[#fbf6ee]" : "border-[#e3e6eb] bg-white hover:border-[#d5dbe3]"
                )}
              >
                <span
                  className="absolute inset-y-0 right-0 bg-primary/10"
                  style={{ width: `${Math.round((count / total) * 100)}%` }}
                />
                <span className="relative flex items-center justify-between gap-3">
                  <span className="text-[15px]">{option.label}</span>
                  <span className="text-[13px] font-light tabular-nums text-muted-foreground">{count}</span>
                </span>
              </button>
            );
          })}
        </div>
      </section>
    </div>
  );
}
