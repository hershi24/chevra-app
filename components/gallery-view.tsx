"use client";

import { useMemo, useRef, useState } from "react";
import Link from "next/link";
import { Music, Play, Trash2, Upload, X } from "lucide-react";
import { toast } from "sonner";
import { useApp } from "@/components/app-provider";
import { MediaProgressOverlay } from "@/components/media-progress";
import { VoiceNotePlayer } from "@/components/voice-note-player";
import { Button } from "@/components/ui/button";
import {
  formatDateShortHe,
  gatheringLabel,
  memberById,
} from "@/lib/format";
import { can, canDeleteMedia } from "@/lib/permissions";
import { galleryItems, upcomingGathering, type GalleryItem } from "@/lib/selectors";
import type { EventMedia } from "@/lib/types";
import { createLocalUpload, preloadMedia, uploadWithProgress } from "@/lib/upload-client";
import { cn } from "@/lib/utils";

type KindFilter = "all" | "image" | "video" | "audio";
type DateSort = "newest" | "oldest";

export function GalleryView() {
  const { state, me, act } = useApp();
  const fileRef = useRef<HTMLInputElement>(null);
  const [kind, setKind] = useState<KindFilter>("all");
  const [caption, setCaption] = useState("");
  const [eventId, setEventId] = useState("");
  const [pending, setPending] = useState<{
    previewUrl: string;
    type: "image" | "video" | "audio" | "file";
    progress: number;
    remainingSeconds: number | null;
  } | null>(null);
  const [memberId, setMemberId] = useState("all");
  const [dateSort, setDateSort] = useState<DateSort>("newest");
  const [activeId, setActiveId] = useState<string | null>(null);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [deleting, setDeleting] = useState(false);

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

  if (!state || !me) return null;

  const gatherings = [...state.gatherings].sort(
    (a, b) => +new Date(b.startsAt) - +new Date(a.startsAt)
  );
  const targetId = eventId || upcomingGathering(state)?.id || gatherings[0]?.id || "";

  function openItem(id: string, confirm = false) {
    setActiveId(id);
    setConfirmDelete(confirm);
  }

  async function deleteActive() {
    if (!active || deleting) return;
    setDeleting(true);
    try {
      await act({ type: "deleteMedia", eventId: active.eventId, mediaId: active.id });
      setActiveId(null);
      setConfirmDelete(false);
      toast.success("המדיה נמחקה");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "המחיקה נכשלה");
    } finally {
      setDeleting(false);
    }
  }

  async function uploadFile(file: File) {
    if (!me || !targetId) return;
    const local = createLocalUpload(file);
    const type: EventMedia["type"] =
      local.type === "video" ? "video" : local.type === "audio" ? "audio" : "image";
    setPending({
      previewUrl: local.previewUrl,
      type: local.type,
      progress: 0,
      remainingSeconds: null,
    });
    try {
      const data = await uploadWithProgress(file, { gatheringId: targetId }, ({ percent, remainingSeconds }) => {
        setPending((prev) => (prev ? { ...prev, progress: percent, remainingSeconds } : prev));
      });
      await preloadMedia(data.url, local.type);
      await act({
        type: "uploadMedia",
        eventId: targetId,
        media: {
          id: crypto.randomUUID(),
          type,
          url: data.url,
          caption: caption.trim() || undefined,
          uploadedBy: me.id,
          createdAt: new Date().toISOString(),
        },
      });
      setCaption("");
      toast.success("המדיה נוספה לגלריה");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "העלאה נכשלה");
    } finally {
      URL.revokeObjectURL(local.previewUrl);
      setPending(null);
      if (fileRef.current) fileRef.current.value = "";
    }
  }

  return (
    <div className="mx-auto max-w-6xl space-y-6">
      <div>
        <p className="text-[13px] font-light text-muted-foreground">כל התמונות, הסרטונים והאודיו של החבורה</p>
        <h1 className="mt-1 text-[1.65rem] font-medium tracking-tight md:text-[2rem]">גלריה</h1>
      </div>

      {can(me, "uploadMedia") ? (
        <div className="paper-card space-y-3 rounded-[1.75rem] px-4 py-4 md:px-5">
          <input
            ref={fileRef}
            type="file"
            accept="image/*,video/*,audio/*"
            className="hidden"
            onChange={(e) => {
              const file = e.target.files?.[0];
              if (file) void uploadFile(file);
            }}
          />
          <label className="grid gap-1.5 text-[13px] font-light text-muted-foreground">
            תיאור
            <input
              value={caption}
              onChange={(e) => setCaption(e.target.value)}
              placeholder="מה רואים כאן?"
              className="h-10 rounded-xl border border-black/8 bg-white px-3 text-sm text-foreground"
            />
          </label>
          {gatherings.length > 1 ? (
            <label className="grid gap-1.5 text-[13px] font-light text-muted-foreground">
              לשייך לחברה
              <select
                value={targetId}
                onChange={(e) => setEventId(e.target.value)}
                className="h-10 rounded-xl border border-black/8 bg-white px-3 text-sm text-foreground"
              >
                {gatherings.map((event) => (
                  <option key={event.id} value={event.id}>
                    {gatheringLabel(event)}
                  </option>
                ))}
              </select>
            </label>
          ) : null}
          <Button
            type="button"
            className="h-11 w-full rounded-xl md:w-auto"
            disabled={!targetId || Boolean(pending)}
            onClick={() => fileRef.current?.click()}
          >
            <Upload data-icon="inline-start" />
            {pending ? "מעלה…" : "העלאת מדיה"}
          </Button>
          {pending ? (
            <MediaProgressOverlay
              src={pending.previewUrl}
              type={pending.type}
              progress={pending.progress}
              remainingSeconds={pending.remainingSeconds}
              mediaClassName="max-h-48"
            />
          ) : null}
        </div>
      ) : null}

      <div className="paper-card flex flex-col gap-3 rounded-[1.75rem] px-4 py-4 md:flex-row md:flex-wrap md:items-center md:gap-4 md:px-5">
        <FilterPills
          value={kind}
          onChange={setKind}
          options={[
            { id: "all", label: "הכל" },
            { id: "image", label: "תמונות" },
            { id: "video", label: "סרטונים" },
            { id: "audio", label: "אודיו" },
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
            <div key={item.id} className="group relative overflow-hidden rounded-2xl bg-muted">
            <button
              type="button"
              onClick={() => openItem(item.id)}
              className="block w-full"
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
                ) : item.type === "audio" ? (
                  <div className="flex h-full w-full items-center justify-center bg-neutral-800">
                    <Music className="size-8 text-white" />
                  </div>
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
            {canDeleteMedia(me, item) ? (
              <button
                type="button"
                aria-label="מחק"
                className="absolute top-2 start-2 z-10 flex size-8 items-center justify-center rounded-full bg-black/55 text-white"
                onClick={() => openItem(item.id, true)}
              >
                <Trash2 className="size-4" />
              </button>
            ) : null}
            </div>
          ))}
        </div>
      )}

      {active ? (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/55 p-4"
          onClick={() => {
            setConfirmDelete(false);
            setActiveId(null);
          }}
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
              <div className="flex items-center gap-1">
                {canDeleteMedia(me, active) ? (
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon-sm"
                    aria-label="מחק"
                    className="text-destructive hover:bg-destructive/10 hover:text-destructive"
                    onClick={() => setConfirmDelete(true)}
                  >
                    <Trash2 className="size-4" />
                  </Button>
                ) : null}
                <Button
                  variant="ghost"
                  size="icon-sm"
                  aria-label="סגירה"
                  onClick={() => setActiveId(null)}
                >
                  <X className="size-4" />
                </Button>
              </div>
            </div>
            {confirmDelete && canDeleteMedia(me, active) ? (
              <div className="mb-3 rounded-xl bg-destructive/10 px-3 py-3">
                <p className="text-sm font-medium">למחוק את המדיה?</p>
                <p className="mt-1 text-sm font-light text-muted-foreground">
                  {active.uploadedBy === me.id
                    ? "הפריט יוסר מהגלריה."
                    : "אתם מוחקים מדיה של חבר. הפריט יוסר מהגלריה."}
                </p>
                <div className="mt-3 flex gap-2">
                  <Button
                    type="button"
                    variant="destructive"
                    className="h-10 rounded-xl"
                    disabled={deleting}
                    onClick={() => void deleteActive()}
                  >
                    <Trash2 data-icon="inline-start" />
                    {deleting ? "מוחק…" : "מחק"}
                  </Button>
                  <Button
                    type="button"
                    variant="outline"
                    className="h-10 rounded-xl"
                    disabled={deleting}
                    onClick={() => setConfirmDelete(false)}
                  >
                    ביטול
                  </Button>
                </div>
              </div>
            ) : null}
            <LightboxBody
              item={active}
              authorName={memberById(state.members, active.uploadedBy)?.displayName}
              onPrev={
                activeIndex > 0
                  ? () => openItem(filtered[activeIndex - 1].id)
                  : undefined
              }
              onNext={
                activeIndex < filtered.length - 1
                  ? () => openItem(filtered[activeIndex + 1].id)
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
        ) : item.type === "audio" ? (
          <div className="flex items-center justify-center bg-[#f7f8f9] px-4 py-10">
            <VoiceNotePlayer src={item.url} />
          </div>
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

