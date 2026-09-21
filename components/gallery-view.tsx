"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { Play } from "lucide-react";
import { useApp } from "@/components/app-provider";
import { Dialog, DialogContent, DialogTitle } from "@/components/ui/dialog";
import {
  formatDateShortHe,
  memberById,
} from "@/lib/format";
import { galleryItems, type GalleryItem } from "@/lib/selectors";
import { cn } from "@/lib/utils";

type KindFilter = "all" | "image" | "video";
type DateSort = "newest" | "oldest";

export function GalleryView() {
  const { state } = useApp();
  const [kind, setKind] = useState<KindFilter>("all");
  const [memberId, setMemberId] = useState("all");
  const [dateSort, setDateSort] = useState<DateSort>("newest");
  const [activeId, setActiveId] = useState<string | null>(null);

  const items = useMemo(() => (state ? galleryItems(state) : []), [state]);

  const uploaders = useMemo(() => {
    if (!state) return [];
    const ids = [...new Set(items.map((item) => item.uploadedBy))];
    return ids
      .map((id) => memberById(state.members, id))
      .filter((member): member is NonNullable<typeof member> => Boolean(member));
  }, [items, state]);

  const filtered = useMemo(() => {
    const next = items.filter((item) => {
      if (kind !== "all" && item.type !== kind) return false;
      if (memberId !== "all" && item.uploadedBy !== memberId) return false;
      return true;
    });
    next.sort((a, b) => {
      const delta = +new Date(a.createdAt) - +new Date(b.createdAt);
      return dateSort === "newest" ? -delta : delta;
    });
    return next;
  }, [items, kind, memberId, dateSort]);

  const activeIndex = filtered.findIndex((item) => item.id === activeId);
  const active = activeIndex >= 0 ? filtered[activeIndex] : null;

  if (!state) return null;

  return (
    <div className="mx-auto max-w-6xl space-y-6">
      <div>
        <p className="text-[13px] font-light text-muted-foreground">כל התמונות והסרטונים של החבורה</p>
        <h1 className="mt-1 text-[1.65rem] font-medium tracking-tight md:text-[2rem]">גלריה</h1>
      </div>

      <div className="flex flex-col gap-3 rounded-[1.75rem] bg-white/55 px-4 py-4 backdrop-blur-md md:flex-row md:flex-wrap md:items-center md:gap-4 md:px-5">
        <FilterPills
          value={kind}
          onChange={setKind}
          options={[
            { id: "all", label: "הכל" },
            { id: "image", label: "תמונות" },
            { id: "video", label: "סרטונים" },
          ]}
        />
        <label className="flex min-w-0 items-center gap-2 text-[13px] font-light text-muted-foreground">
          לפי חבר
          <select
            value={memberId}
            onChange={(e) => setMemberId(e.target.value)}
            className="h-8 rounded-full border border-black/8 bg-white/80 px-3 text-[13px] text-foreground"
          >
            <option value="all">כולם</option>
            {uploaders.map((member) => (
              <option key={member.id} value={member.id}>
                {member.displayName}
              </option>
            ))}
          </select>
        </label>
        <label className="flex min-w-0 items-center gap-2 text-[13px] font-light text-muted-foreground">
          תאריך העלאה
          <select
            value={dateSort}
            onChange={(e) => setDateSort(e.target.value as DateSort)}
            className="h-8 rounded-full border border-black/8 bg-white/80 px-3 text-[13px] text-foreground"
          >
            <option value="newest">חדש לישן</option>
            <option value="oldest">ישן לחדש</option>
          </select>
        </label>
        <span className="text-[12px] font-light text-muted-foreground md:ms-auto">
          {filtered.length} פריטים
        </span>
      </div>

      {filtered.length === 0 ? (
        <p className="rounded-[1.75rem] bg-white/55 px-5 py-12 text-center text-sm font-light text-muted-foreground">
          אין מדיה שמתאימה לסינון הזה.
        </p>
      ) : (
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4 md:gap-4">
          {filtered.map((item) => {
            const author = memberById(state.members, item.uploadedBy);
            return (
              <button
                key={item.id}
                type="button"
                onClick={() => setActiveId(item.id)}
                className="group overflow-hidden rounded-2xl bg-muted text-start"
              >
                <div className="relative aspect-square">
                  {item.type === "image" ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      src={item.url}
                      alt={item.caption || item.eventLabel}
                      className="h-full w-full object-cover transition duration-700 group-hover:scale-[1.03]"
                    />
                  ) : (
                    <>
                      <video
                        src={item.url}
                        muted
                        playsInline
                        preload="metadata"
                        className="h-full w-full object-cover"
                      />
                      <span className="absolute inset-0 flex items-center justify-center bg-black/25">
                        <Play className="size-8 text-white" fill="currentColor" />
                      </span>
                    </>
                  )}
                </div>
                <div className="px-2.5 py-2">
                  <div className="truncate text-[12px] font-normal">{item.eventLabel}</div>
                  <div className="truncate text-[11px] font-light text-muted-foreground">
                    {author?.displayName} · {formatDateShortHe(item.createdAt)}
                  </div>
                </div>
              </button>
            );
          })}
        </div>
      )}

      <Dialog open={Boolean(active)} onOpenChange={(open) => !open && setActiveId(null)}>
        <DialogContent
          showCloseButton
          className="max-h-[92vh] overflow-y-auto sm:max-w-3xl"
        >
          <DialogTitle className="text-base font-medium">{active?.eventLabel ?? "גלריה"}</DialogTitle>
          {active ? (
            <LightboxBody
              item={active}
              authorName={memberById(state.members, active.uploadedBy)?.displayName}
              onPrev={
                activeIndex > 0 ? () => setActiveId(filtered[activeIndex - 1].id) : undefined
              }
              onNext={
                activeIndex < filtered.length - 1
                  ? () => setActiveId(filtered[activeIndex + 1].id)
                  : undefined
              }
            />
          ) : null}
        </DialogContent>
      </Dialog>
    </div>
  );
}

function FilterPills<T extends string>({
  value,
  onChange,
  options,
}: {
  value: T;
  onChange: (value: T) => void;
  options: { id: T; label: string }[];
}) {
  return (
    <div className="flex flex-wrap gap-1">
      {options.map((option) => (
        <button
          key={option.id}
          type="button"
          onClick={() => onChange(option.id)}
          className={cn(
            "rounded-full px-3 py-1.5 text-[13px] font-light transition",
            value === option.id
              ? "bg-foreground text-background"
              : "text-muted-foreground hover:bg-black/4 hover:text-foreground"
          )}
        >
          {option.label}
        </button>
      ))}
    </div>
  );
}

function LightboxBody({
  item,
  authorName,
  onPrev,
  onNext,
}: {
  item: GalleryItem;
  authorName?: string;
  onPrev?: () => void;
  onNext?: () => void;
}) {
  return (
    <div className="space-y-3">
      <div className="overflow-hidden rounded-xl bg-black">
        {item.type === "image" ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={item.url}
            alt={item.caption || item.eventLabel}
            className="max-h-[60vh] w-full object-contain"
          />
        ) : (
          <video src={item.url} controls playsInline className="max-h-[60vh] w-full bg-black" />
        )}
      </div>
      <div className="flex flex-wrap items-center justify-between gap-2 text-[13px] font-light text-muted-foreground">
        <div>
          {authorName ? `${authorName} · ` : ""}
          {formatDateShortHe(item.createdAt)}
          {item.caption ? ` · ${item.caption}` : ""}
        </div>
        <Link href={`/journal/${item.eventId}`} className="text-primary/80 hover:text-primary">
          למפגש ביומן
        </Link>
      </div>
      <div className="flex justify-between gap-2">
        <button
          type="button"
          onClick={onPrev}
          disabled={!onPrev}
          className="text-[13px] font-light text-muted-foreground disabled:opacity-30"
        >
          הקודם
        </button>
        <button
          type="button"
          onClick={onNext}
          disabled={!onNext}
          className="text-[13px] font-light text-muted-foreground disabled:opacity-30"
        >
          הבא
        </button>
      </div>
    </div>
  );
}

