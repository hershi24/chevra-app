"use client";

import { useState } from "react";
import { Clock, MapPin } from "lucide-react";
import { toast } from "sonner";
import { useApp } from "@/components/app-provider";
import { BoardFileCard } from "@/components/board-file-card";
import { UserAvatar } from "@/components/user-avatar";
import { resolveBoard, visibleHomePhotos } from "@/lib/community-board";
import { formatHebrewDate, formatTimeHe, gatheringHeadline, gatheringLabel, memberById } from "@/lib/format";
import { kibudTurn } from "@/lib/kibud";
import { NavigateLink } from "@/components/navigate-link";
import { upcomingGathering } from "@/lib/selectors";
import { cn } from "@/lib/utils";

const CARD = "rounded-[1.5rem] border border-[#d5dbe3] bg-[#fbfcfd] shadow-[0_10px_28px_rgba(80,90,105,0.05)]";

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
  const photos = visibleHomePhotos(board, state);
  const host = next ? memberById(state.members, next.hostId) : null;
  const turn = next ? kibudTurn(state, next) : null;
  const nextHeadline = next ? gatheringHeadline(next) : null;
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

  const pollBlock = (
    <section className={cn(CARD, "px-5 py-5 md:px-6")}>
      <h2 className="text-[1.05rem] font-medium">סקר</h2>
      <p className="mt-1 text-[15px] leading-7">{board.poll.question}</p>
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
                <span className="text-[14.5px]">{option.label}</span>
                <span className="text-[13px] font-light tabular-nums text-muted-foreground">{count}</span>
              </span>
            </button>
          );
        })}
      </div>
    </section>
  );

  const imageNotices = notices.filter((notice) => notice.image);
  const textNotices = notices.filter((notice) => !notice.image && (notice.title || notice.body));

  return (
    <div className="mx-auto flex w-full max-w-[1400px] flex-col gap-8 md:gap-10">
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

      <div className="grid gap-8 md:gap-10 lg:grid-cols-[minmax(0,1fr)_20rem] lg:items-start lg:gap-8 xl:grid-cols-[minmax(0,1fr)_22rem]">
        <div className="flex min-w-0 flex-col gap-8 md:gap-10">
          <section className={cn(CARD, "overflow-hidden")}>
            <div className="grid gap-0 md:grid-cols-[minmax(0,1.3fr)_minmax(16rem,0.9fr)] lg:grid-cols-1">
              <div className="relative px-5 py-6 md:px-8 md:py-8 lg:px-10 lg:py-9">
                <span className="absolute inset-y-0 right-0 w-1 bg-primary/70" aria-hidden />
                <p className="text-[12px] font-light tracking-wide text-primary">ההתכנסות הקרובה</p>
                {next ? (
                  <div className="lg:flex lg:items-end lg:justify-between lg:gap-10">
                    <div className="min-w-0">
                      <h2 className="mt-2 text-[1.7rem] leading-tight font-medium md:text-[2.1rem]">
                        {nextHeadline?.heading || (next ? gatheringLabel(next) : "")}
                      </h2>
                      {nextHeadline?.body ? (
                        <p className="mt-1.5 max-w-xl whitespace-pre-line text-[15px] font-light leading-6 text-[#4b5563]">
                          {nextHeadline.body}
                        </p>
                      ) : null}
                      <p className="mt-1.5 text-[15px] font-light text-[#3f4650]">{formatHebrewDate(next.startsAt)}</p>
                      <div className="mt-4 flex flex-wrap gap-x-5 gap-y-1 text-[14px] font-light text-[#4b5563]">
                        {next.location ? (
                          <span className="inline-flex items-center gap-1.5">
                            <MapPin className="size-3.5 text-primary" />
                            {next.location}
                            <NavigateLink location={next.location} />
                          </span>
                        ) : null}
                        {host ? <span>מארח: {host.displayName}</span> : null}
                        {turn?.duty ? <span>תורן כיבוד: {turn.duty.displayName}</span> : null}
                        {turn?.next ? <span>הבא בתור: {turn.next.displayName}</span> : null}
                      </div>
                    </div>
                    <p className="mt-3 shrink-0 text-[1.45rem] font-medium tabular-nums text-primary md:text-[1.8rem] lg:mt-0 lg:text-[2.4rem] lg:leading-none">
                      {formatTimeHe(next.startsAt)}
                    </p>
                  </div>
                ) : (
                  <h2 className="mt-2 text-[1.5rem] font-medium">אין התכנסות קרובה ביומן</h2>
                )}
                {more.length ? (
                  <ul className="mt-5 grid gap-x-8 gap-y-1.5 border-t border-[#e9ecef] pt-4 text-[14px] font-light text-[#3f4650] lg:grid-cols-2">
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
              <div className="grid grid-cols-2 gap-px bg-[#e9ecef] md:grid-cols-1 lg:hidden">
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
              <h2 className="mb-3 text-[1.1rem] font-medium">מודעות</h2>
              {imageNotices.length ? (
                <div className={cn("grid grid-cols-2 gap-3 sm:grid-cols-3 xl:grid-cols-4", textNotices.length && "mb-3")}>
                  {imageNotices.map((notice) => (
                    <BoardFileCard key={notice.id} title={notice.title || "מודעה"} url={notice.image!} />
                  ))}
                </div>
              ) : null}
              {textNotices.length ? (
                <div className="grid gap-3 md:grid-cols-2">
                  {textNotices.map((notice) => (
                    <article key={notice.id} className={cn(CARD, "px-5 py-4")}>
                      <h3 className="text-[15.5px]">{notice.title}</h3>
                      {notice.body ? (
                        <p className="mt-1.5 text-[14px] font-light leading-7 text-[#3f4650]">{notice.body}</p>
                      ) : null}
                    </article>
                  ))}
                </div>
              ) : null}
            </section>
          ) : null}

          <div className={cn("grid gap-8 md:gap-10", board.files.length && photos.length && "xl:grid-cols-2 xl:gap-8")}>
            {board.files.length ? (
              <section className="min-w-0">
                <h2 className="mb-3 text-[1.1rem] font-medium">דפי לימוד</h2>
                <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 xl:grid-cols-2">
                  {board.files.map((file) => (
                    <BoardFileCard key={file.id} title={file.title} url={file.url} />
                  ))}
                </div>
              </section>
            ) : null}

            {photos.length ? (
              <section className="min-w-0">
                <h2 className="mb-3 text-[1.1rem] font-medium">תמונות מהחבורה</h2>
                <div className={cn("grid grid-cols-2 gap-3 md:grid-cols-3", board.files.length ? "xl:grid-cols-2" : "xl:grid-cols-4")}>
                  {photos.map((photo) => (
                    <figure key={photo.id} className={cn(CARD, "overflow-hidden")}>
                      <img src={photo.url} alt={photo.caption} className="aspect-[4/3] w-full object-cover" />
                      <figcaption className="px-3 py-2 text-[13px] font-light text-[#3f4650]">{photo.caption}</figcaption>
                    </figure>
                  ))}
                </div>
              </section>
            ) : null}
          </div>
        </div>

        <aside className="flex min-w-0 flex-col gap-6 lg:sticky lg:top-24">
          <section className={cn(CARD, "hidden overflow-hidden lg:block")}>
            <h2 className="flex items-center gap-2 px-5 pt-5 pb-2 text-[1.05rem] font-medium">
              <Clock className="size-4 text-primary" />
              זמני תפילה
            </h2>
            <ul className="divide-y divide-[#e9ecef] px-5 pb-2">
              {board.prayers.map((prayer) => (
                <li key={prayer.id} className="flex items-baseline justify-between gap-3 py-3">
                  <span className="text-[14.5px] font-light text-[#3f4650]">{prayer.name}</span>
                  <span className="text-[1.3rem] font-medium tabular-nums">{prayer.time}</span>
                </li>
              ))}
            </ul>
          </section>
          {pollBlock}
        </aside>
      </div>
    </div>
  );
}
