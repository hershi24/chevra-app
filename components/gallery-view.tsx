"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { Play, X } from "lucide-react";
import { useApp } from "@/components/app-provider";
import { Button } from "@/components/ui/button";
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

      <div className="paper-card flex flex-col gap-3 rounded-[1.75rem] px-4 py-4 md:flex-row md:flex-wrap md:items-center md:gap-4 md:px-5">
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
            className="h-8 min-w-[9rem] rounded-full border border-black/8 bg-white/80 px-3 text-[13px] text-foreground"
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
            className="h-8 min-w-[8rem] rounded-full border border-black/8 bg-white/80 px-3 text-[13px] text-foreground"
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
        <p className="paper-card rounded-[1.75rem] px-5 py-12 text-center text-sm font-light text-muted-foreground">
          אין מדיה שמתאימה לסינון הזה.
        </p>
      ) : (
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 md:grid-cols-4 md:gap-3">
          {filtered.map((item) => (
            <button
              key={item.id}
              type="button"
              onClick={() => setActiveId(item.id)}
              className="group relative overflow-hidden rounded-2xl bg-muted"
              aria-label={item.caption || item.eventLabel}
            >
              <div className="aspect-square">
                {item.type === "image" ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={item.url}
                    alt=""
                    className="h-full w-full object-cover transition duration-700 group-hover:scale-[1.03]"
                  />
                ) : (
                  <video
                    src={item.url}
                    muted
                    playsInline
                    preload="metadata"
                    className="h-full w-full object-cover"
                  />
                )}
              </div>
              {item.type === "video" ? (
                <span className="absolute inset-0 flex items-center justify-center bg-black/20">
                  <Play className="size-8 text-white" fill="currentColor" />
                </span>
              ) : null}
            </button>
          ))}
        </div>
      )}

      {active ? (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/55 p-4"
          onClick={() => setActiveId(null)}
        >
          <div
            role="dialog"
            aria-modal="true"
            aria-label={active.eventLabel}
            className="relative max-h-[92vh] w-full max-w-4xl overflow-y-auto rounded-2xl bg-white p-4 shadow-2xl"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="mb-3 flex items-start justify-between gap-3">
              <h2 className="text-base font-medium">{active.eventLabel}</h2>
              <Button
                variant="ghost"
                size="icon-sm"
                aria-label="סגירה"
                onClick={() => setActiveId(null)}
              >
                <X className="size-4" />
              </Button>
            </div>
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
          </div>
        </div>
      ) : null}
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
      <div className="overflow-hidden rounded-xl bg-[#111]">
        {item.type === "image" ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={item.url}
            alt={item.caption || item.eventLabel}
            className="mx-auto max-h-[70vh] w-auto max-w-full object-contain"
          />
        ) : (
          <video
            src={item.url}
            controls
            playsInline
            className="mx-auto max-h-[70vh] w-auto max-w-full"
          />
        )}
      </div>
      <div className="flex flex-wrap items-center justify-between gap-2 text-[13px] font-light text-muted-foreground">
        <div>
          {authorName ? `${authorName} · ` : ""}
          {formatDateShortHe(item.createdAt)}
          {item.caption ? ` · ${item.caption}` : ""}
        </div>
        <Link href={`/journal/${item.eventId}`} className="text-primary/80 hover:text-primary">
          לחברה ביומן
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

