"use client";

import Link from "next/link";
import { formatDateHe, memberById } from "@/lib/format";
import { useApp } from "@/components/app-provider";

export function JournalView() {
  const { state } = useApp();
  if (!state) return null;
  const items = [...state.gatherings].sort(
    (a, b) => +new Date(b.startsAt) - +new Date(a.startsAt)
  );

  return (
    <div className="mx-auto max-w-6xl space-y-6">
      <div>
        <p className="text-sm text-muted-foreground">תיעוד המפגשים</p>
        <h1 className="font-heading text-3xl font-semibold text-primary">יומן החבורה</h1>
      </div>
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
        {items.map((event) => {
          const cover = event.media.find((m) => m.type === "image");
          const host = memberById(state.members, event.hostId);
          const isUpcoming = event.status === "upcoming";
          return (
            <Link
              key={event.id}
              href={`/journal/${event.id}`}
              className="group overflow-hidden rounded-2xl bg-white/80 ring-1 ring-black/5 backdrop-blur-md"
            >
              <div className="relative aspect-[16/10] bg-[#efe6d8]">
                {cover ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={cover.url}
                    alt={event.title}
                    className="h-full w-full object-cover transition duration-500 group-hover:scale-105"
                  />
                ) : (
                  <div className="flex h-full items-center justify-center text-sm text-muted-foreground">
                    עדיין אין תמונות
                  </div>
                )}
                <span className="absolute end-3 top-3 rounded-full bg-white/90 px-2.5 py-1 text-[11px] font-medium">
                  {isUpcoming ? "קרוב" : "התקיים"}
                </span>
              </div>
              <div className="space-y-1 p-4">
                <div className="font-medium">{event.title}</div>
                <div className="text-sm text-muted-foreground">{formatDateHe(event.startsAt)}</div>
                <div className="text-xs text-muted-foreground">
                  {host?.displayName} · {event.media.length} קבצי מדיה
                </div>
              </div>
            </Link>
          );
        })}
      </div>
    </div>
  );
}
