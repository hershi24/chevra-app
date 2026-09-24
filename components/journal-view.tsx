"use client";

import { useState } from "react";
import Link from "next/link";
import { Trash2 } from "lucide-react";
import { toast } from "sonner";
import { formatDateHe, gatheringLabel, memberById } from "@/lib/format";
import { isAdmin } from "@/lib/permissions";
import { isPastGathering } from "@/lib/selectors";
import { useApp } from "@/components/app-provider";
import { Button } from "@/components/ui/button";

export function JournalView() {
  const { state, me, act } = useApp();
  const [confirmId, setConfirmId] = useState<string | null>(null);
  const [deleting, setDeleting] = useState(false);
  if (!state || !me) return null;
  const items = [...state.gatherings].sort(
    (a, b) => +new Date(b.startsAt) - +new Date(a.startsAt)
  );

  const confirm = items.find((event) => event.id === confirmId) ?? null;

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
          const canDelete = isAdmin(me) && isPastGathering(event);
          return (
            <div key={event.id}>
            <Link href={`/journal/${event.id}`} className="group block">
              <div className="relative aspect-[16/10] overflow-hidden rounded-2xl bg-secondary">
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
            {canDelete ? (
              <Button
                type="button"
                variant="ghost"
                size="xs"
                className="mt-1 text-destructive hover:bg-destructive/10 hover:text-destructive"
                onClick={() => setConfirmId(event.id)}
              >
                <Trash2 data-icon="inline-start" />
                מחק
              </Button>
            ) : null}
            </div>
          );
        })}
      </div>
      {confirm ? (
        <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/45 p-4 md:items-center">
          <div role="dialog" aria-modal="true" className="w-full max-w-md rounded-2xl bg-white p-4 shadow-2xl">
            <h2 className="text-base font-medium">למחוק את החברה?</h2>
            <p className="mt-1 text-sm font-light leading-6 text-muted-foreground">
              {gatheringLabel(confirm)} תוסר מהיומן, כולל התמונות, הסיכום וההזמנות שלה.
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
