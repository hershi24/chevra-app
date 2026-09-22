"use client";

import Link from "next/link";
import { formatDateHe, gatheringLabel, memberById } from "@/lib/format";
import { useApp } from "@/components/app-provider";

export function JournalView() {
  const { state } = useApp();
  if (!state) return null;
  const items = [...state.gatherings].sort(
    (a, b) => +new Date(b.startsAt) - +new Date(a.startsAt)
  );

  return (
    <div className="mx-auto max-w-6xl space-y-8">
      <div>
        <p className="text-[13px] font-light text-muted-foreground">תיעוד החברות</p>
        <h1 className="mt-1 text-[1.65rem] font-medium tracking-tight md:text-[2rem]">יומן החבורה</h1>
      </div>
      <div className="grid gap-6 sm:grid-cols-2">
        {items.map((event) => {
          const cover = event.media.find((m) => m.type === "image");
          const host = memberById(state.members, event.hostId);
          const isUpcoming = event.status === "upcoming";
          return (
            <Link key={event.id} href={`/journal/${event.id}`} className="group block">
              <div className="relative aspect-[16/10] overflow-hidden rounded-2xl bg-[#efe6d8]">
                {cover ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={cover.url}
                    alt={gatheringLabel(event)}
                    className="h-full w-full object-cover transition duration-700 group-hover:scale-[1.03]"
                  />
                ) : (
                  <div className="flex h-full items-center justify-center text-sm font-light text-muted-foreground">
                    עדיין אין תמונות
                  </div>
                )}
                <span className="absolute end-3 top-3 rounded-full bg-white/90 px-2.5 py-1 text-[11px] font-light">
                  {isUpcoming ? "קרוב" : "חברה קודמת"}
                </span>
              </div>
              <div className="mt-2.5 space-y-0.5">
                <div className="truncate text-[13px] font-normal">{gatheringLabel(event)}</div>
                <div className="text-[12px] font-light text-muted-foreground">
                  {formatDateHe(event.startsAt)}
                  {host ? ` · ${host.displayName}` : ""}
                </div>
              </div>
            </Link>
          );
        })}
      </div>
    </div>
  );
}
