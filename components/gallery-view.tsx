"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import {
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  Download,
  Play,
  Send,
  Trash2,
  Upload,
  X,
} from "lucide-react";
import { toast } from "sonner";
import { useApp } from "@/components/app-provider";
import { UserAvatar } from "@/components/user-avatar";
import { VoiceNotePlayer } from "@/components/voice-note-player";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogTitle } from "@/components/ui/dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { canSeeChannel, guideChatTitle, isGeneralChannel, isGuideChannel } from "@/lib/channels";
import {
  formatDateShortHe,
  formatHebrewDate,
  formatRelativeHe,
  gatheringLabel,
  memberById,
} from "@/lib/format";
import { can, canDeleteMedia } from "@/lib/permissions";
import { dmName, galleryItems, type GalleryItem } from "@/lib/selectors";
import type { Channel, EventMedia, Gathering, Member } from "@/lib/types";
import { createLocalUpload, preloadMedia, uploadWithProgress, type LocalUpload } from "@/lib/upload-client";
import { cn } from "@/lib/utils";

type KindFilter = "all" | "image" | "video" | "audio";
type DateSort = "newest" | "oldest";
const LOOSE = "loose";

type Group = {
  id: string;
  title: string;
  date: string | null;
  items: GalleryItem[];
};

export function GalleryView() {
  const { state, me, act } = useApp();
  const [kind, setKind] = useState<KindFilter>("all");
  const [memberId, setMemberId] = useState("all");
  const [dateSort, setDateSort] = useState<DateSort>("newest");
  const [album, setAlbum] = useState("all");
  const [activeId, setActiveId] = useState<string | null>(null);
  const [uploadOpen, setUploadOpen] = useState(false);

  const items = useMemo(() => (state ? galleryItems(state) : []), [state]);

  const eventsById = useMemo(
    () => new Map((state?.gatherings ?? []).map((event) => [event.id, event])),
    [state]
  );

  const albums = useMemo(() => {
    const ids = new Set(items.map((item) => item.eventId || LOOSE));
    const events = [...eventsById.values()]
      .filter((event) => ids.has(event.id))
      .sort((a, b) => +new Date(b.startsAt) - +new Date(a.startsAt));
    return { events, loose: ids.has(LOOSE) };
  }, [items, eventsById]);

  const uploaders = useMemo(() => {
    if (!state) return [];
    return [...new Set(items.map((item) => item.uploadedBy))]
      .map((id) => memberById(state.members, id))
      .filter((member): member is Member => Boolean(member));
  }, [items, state]);

  const groups = useMemo<Group[]>(() => {
    const byTime = (a: GalleryItem, b: GalleryItem) => {
      const delta = +new Date(a.createdAt) - +new Date(b.createdAt);
      return dateSort === "newest" ? -delta : delta;
    };
    const visible = items.filter((item) => {
      if (kind !== "all" && item.type !== kind) return false;
      if (memberId !== "all" && item.uploadedBy !== memberId) return false;
      if (album !== "all" && (item.eventId || LOOSE) !== album) return false;
      return true;
    });
    const order = dateSort === "newest" ? albums.events : [...albums.events].reverse();
    const out: Group[] = order
      .map((event) => ({
        id: event.id,
        title: gatheringLabel(event),
        date: formatHebrewDate(event.startsAt),
        items: visible.filter((item) => item.eventId === event.id).sort(byTime),
      }))
      .filter((group) => group.items.length);
    const loose = visible.filter((item) => !item.eventId || !eventsById.has(item.eventId)).sort(byTime);
    if (loose.length) out.push({ id: LOOSE, title: "ללא שיוך לחברה", date: null, items: loose });
    return out;
  }, [items, kind, memberId, album, dateSort, albums, eventsById]);

  const flat = useMemo(() => groups.flatMap((group) => group.items), [groups]);
  const activeIndex = flat.findIndex((item) => item.id === activeId);
  const active = activeIndex >= 0 ? flat[activeIndex] : null;

  if (!state || !me) return null;

  const counts = {
    image: items.filter((item) => item.type === "image").length,
    video: items.filter((item) => item.type === "video").length,
    audio: items.filter((item) => item.type === "audio").length,
  };
  const stats = [
    counts.image ? `${counts.image} תמונות` : null,
    counts.video ? `${counts.video} סרטונים` : null,
    counts.audio ? `${counts.audio} הקלטות` : null,
  ].filter(Boolean);
  const canUpload = can(me, "uploadMedia");

  async function deleteItem(item: GalleryItem) {
    const next = flat[activeIndex + 1] ?? flat[activeIndex - 1] ?? null;
    await act({ type: "deleteMedia", eventId: item.eventId || undefined, mediaId: item.id });
    setActiveId(next && next.id !== item.id ? next.id : null);
    toast.success("המדיה נמחקה");
  }

  return (
    <div className="mx-auto flex max-w-5xl flex-col gap-6 md:gap-7">
      <header className="flex items-end justify-between gap-4">
        <div>
          <p className="text-[13px] font-light text-muted-foreground">כל הרגעים של החבורה</p>
          <h1 className="mt-0.5 text-[1.55rem] font-normal tracking-tight md:text-[1.85rem]">גלריה</h1>
        </div>
        <div className="flex items-center gap-4">
          {stats.length ? (
            <span className="hidden text-[13px] font-light text-muted-foreground md:block">
              {stats.join(" · ")}
            </span>
          ) : null}
          {canUpload ? (
            <Button type="button" className="rounded-full px-4" onClick={() => setUploadOpen(true)}>
              <Upload data-icon="inline-start" />
              העלאה
            </Button>
          ) : null}
        </div>
      </header>

      {albums.events.length + (albums.loose ? 1 : 0) > 1 ? (
        <AlbumStrip
          items={items}
          events={albums.events}
          hasLoose={albums.loose}
          value={album}
          onChange={setAlbum}
        />
      ) : null}

      <div className="flex flex-col gap-3 border-b border-[#e3e7ec] pb-3.5 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex rounded-full bg-[#e9ecef] p-[3px]">
          {(
            [
              ["all", "הכל"],
              ["image", "תמונות"],
              ["video", "סרטונים"],
              ["audio", "אודיו"],
            ] as const
          ).map(([id, label]) => (
            <button
              key={id}
              type="button"
              aria-pressed={kind === id}
              onClick={() => setKind(id)}
              className={cn(
                "flex-1 rounded-full px-3.5 py-1.5 text-[13px] font-normal transition sm:flex-none",
                kind === id
                  ? "bg-white text-foreground shadow-[0_1px_2px_rgba(0,0,0,0.06)]"
                  : "text-foreground/60 hover:text-foreground"
              )}
            >
              {label}
            </button>
          ))}
        </div>
        <div className="flex items-center justify-between gap-5 sm:justify-end">
          <QuietSelect value={memberId} onChange={setMemberId} label="לפי חבר">
            <option value="all">כל החברים</option>
            {uploaders.map((member) => (
              <option key={member.id} value={member.id}>
                {member.displayName}
              </option>
            ))}
          </QuietSelect>
          <QuietSelect value={dateSort} onChange={(v) => setDateSort(v as DateSort)} label="מיון">
            <option value="newest">חדש לישן</option>
            <option value="oldest">ישן לחדש</option>
          </QuietSelect>
        </div>
      </div>

      {groups.length === 0 ? (
        <p className="py-16 text-center text-sm font-light text-muted-foreground">
          {items.length ? "אין מדיה שמתאימה לסינון הזה." : "עוד אין כאן תמונות. העלו את הראשונה!"}
        </p>
      ) : (
        <div className="flex flex-col gap-8">
          {groups.map((group) => (
            <section key={group.id} className="flex flex-col gap-3">
              <div className="flex items-center gap-2.5">
                <div className="flex min-w-0 flex-col sm:flex-row sm:items-baseline sm:gap-2.5">
                  <h2 className="min-w-0 truncate text-[16px] font-normal">{group.title}</h2>
                  <span className="shrink-0 text-[12px] font-light text-muted-foreground">
                    {group.date ? `${group.date} · ` : ""}
                    {group.items.length} פריטים
                  </span>
                </div>
                <span className="ms-auto hidden shrink-0 -space-x-1.5 space-x-reverse sm:flex">
                  {[...new Set(group.items.map((item) => item.uploadedBy))].slice(0, 4).map((id) => (
                    <UserAvatar
                      key={id}
                      member={memberById(state.members, id)}
                      size="sm"
                      className="size-6 text-[9px] ring-2 ring-background"
                    />
                  ))}
                </span>
              </div>
              <div className="-mx-5 grid grid-cols-3 gap-[2px] sm:mx-0 sm:grid-cols-4 sm:gap-1.5 md:grid-cols-5">
                {group.items.map((item) => (
                  <MediaTile
                    key={item.id}
                    item={item}
                    uploader={memberById(state.members, item.uploadedBy)}
                    onOpen={() => setActiveId(item.id)}
                  />
                ))}
              </div>
            </section>
          ))}
        </div>
      )}

      {active ? (
        <Lightbox
          key={active.id}
          item={active}
          index={activeIndex}
          list={flat}
          event={active.eventId ? eventsById.get(active.eventId) : undefined}
          me={me}
          members={state.members}
          channels={state.channels}
          onSelect={setActiveId}
          onClose={() => setActiveId(null)}
          onDelete={deleteItem}
          onShare={async (channel, label) => {
            await act({
              type: "sendMessage",
              id: crypto.randomUUID(),
              channelId: channel.id,
              text: active.caption?.trim() ?? "",
              attachments: [
                {
                  id: crypto.randomUUID(),
                  type: active.type,
                  url: active.url,
                  name: active.caption?.trim() || active.eventLabel,
                },
              ],
            });
            toast.success(`נשלח ל${label}`);
          }}
        />
      ) : null}

      {canUpload ? (
        <UploadDialog
          open={uploadOpen}
          onOpenChange={setUploadOpen}
          events={state.gatherings}
          defaultEventId={album !== "all" && album !== LOOSE ? album : defaultUploadEvent(state.gatherings)}
          onUpload={async (media, eventId) => {
            await act({ type: "uploadMedia", eventId: eventId || undefined, media });
          }}
          me={me}
        />
      ) : null}
    </div>
  );
}

function defaultUploadEvent(events: Gathering[]) {
  const cutoff = Date.now() + 86_400_000;
  return (
    events
      .filter((event) => event.status !== "cancelled" && +new Date(event.startsAt) <= cutoff)
      .sort((a, b) => +new Date(b.startsAt) - +new Date(a.startsAt))[0]?.id ?? ""
  );
}

function QuietSelect({
  value,
  onChange,
  label,
  children,
}: {
  value: string;
  onChange: (value: string) => void;
  label: string;
  children: React.ReactNode;
}) {
  return (
    <label className="relative flex items-center text-[13px] text-foreground/70">
      <span className="sr-only">{label}</span>
      <select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="cursor-pointer appearance-none bg-transparent py-1 pe-5 font-normal outline-none hover:text-foreground"
      >
        {children}
      </select>
      <ChevronDown className="pointer-events-none absolute end-0 size-3.5 text-muted-foreground" aria-hidden />
    </label>
  );
}

function AlbumStrip({
  items,
  events,
  hasLoose,
  value,
  onChange,
}: {
  items: GalleryItem[];
  events: Gathering[];
  hasLoose: boolean;
  value: string;
  onChange: (value: string) => void;
}) {
  const visual = (list: GalleryItem[]) => list.filter((item) => item.type !== "audio");
  const newest = [...items].sort((a, b) => +new Date(b.createdAt) - +new Date(a.createdAt));
  const albumItems = (id: string) => newest.filter((item) => (item.eventId || LOOSE) === id);
  const entries = [
    ...events.map((event) => ({
      id: event.id,
      title: gatheringLabel(event),
      sub: `${formatDateShortHe(event.startsAt)} · ${albumItems(event.id).length} פריטים`,
    })),
    ...(hasLoose ? [{ id: LOOSE, title: "ללא שיוך לחברה", sub: `${albumItems(LOOSE).length} פריטים` }] : []),
  ];

  return (
    <div className="-mx-5 flex gap-2.5 overflow-x-auto px-5 pb-1 [scrollbar-width:none] md:mx-0 md:gap-3.5 md:px-0">
      <AlbumCard
        active={value === "all"}
        title="כל הגלריה"
        sub={`${items.length} פריטים`}
        onClick={() => onChange("all")}
      >
        <div className="grid size-full grid-cols-2 gap-0.5">
          {visual(newest)
            .slice(0, 4)
            .map((item) => (
              <Thumb key={item.id} item={item} />
            ))}
        </div>
      </AlbumCard>
      {entries.map((entry) => {
        const cover = visual(albumItems(entry.id))[0];
        return (
          <AlbumCard
            key={entry.id}
            active={value === entry.id}
            title={entry.title}
            sub={entry.sub}
            onClick={() => onChange(value === entry.id ? "all" : entry.id)}
          >
            {cover ? <Thumb item={cover} /> : <Wave className="size-full bg-[#f5f0e7]" />}
          </AlbumCard>
        );
      })}
    </div>
  );
}

function AlbumCard({
  active,
  title,
  sub,
  onClick,
  children,
}: {
  active: boolean;
  title: string;
  sub: string;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button type="button" onClick={onClick} aria-pressed={active} className="w-[6.75rem] shrink-0 text-start md:w-40">
      <div
        className={cn(
          "h-[4.75rem] overflow-hidden rounded-[12px] bg-[#e7eaee] outline-2 outline-offset-2 transition md:h-[6.75rem] md:rounded-[16px]",
          active ? "outline outline-primary" : "outline-transparent hover:opacity-90"
        )}
      >
        {children}
      </div>
      <div className="mt-1.5 truncate text-[12.5px] font-normal md:mt-2 md:text-[13px]">{title}</div>
      <div className="truncate text-[11px] font-light text-muted-foreground">{sub}</div>
    </button>
  );
}

function Thumb({ item }: { item: GalleryItem }) {
  if (item.type === "video") {
    return (
      <video
        src={`${item.url}#t=0.1`}
        muted
        playsInline
        preload="metadata"
        className="size-full object-cover"
      />
    );
  }
  if (item.type === "audio") return <Wave className="size-full bg-[#f5f0e7]" />;
  // eslint-disable-next-line @next/next/no-img-element
  return <img src={item.url} alt="" loading="lazy" className="size-full object-cover" />;
}

const WAVE = [10, 20, 28, 16, 30, 22, 12, 26, 18, 9, 22, 14];

function Wave({ className, label }: { className?: string; label?: string }) {
  return (
    <div className={cn("relative grid place-items-center", className)}>
      <div className="flex h-8 items-center gap-[3px]" aria-hidden>
        {WAVE.map((h, i) => (
          <span key={i} className="w-[3px] rounded-full bg-[#c9a56a]" style={{ height: h }} />
        ))}
      </div>
      {label ? (
        <span className="absolute bottom-2 text-[11px] font-light text-primary">{label}</span>
      ) : null}
    </div>
  );
}

function formatDuration(seconds: number | null) {
  if (seconds === null || !Number.isFinite(seconds)) return null;
  const total = Math.round(seconds);
  return `${Math.floor(total / 60)}:${String(total % 60).padStart(2, "0")}`;
}

function MediaTile({
  item,
  uploader,
  onOpen,
}: {
  item: GalleryItem;
  uploader?: Member;
  onOpen: () => void;
}) {
  const [duration, setDuration] = useState<number | null>(null);
  const time = formatDuration(duration);
  const label = item.caption?.trim() || uploader?.displayName;

  return (
    <button
      type="button"
      onClick={onOpen}
      aria-label={item.caption || item.eventLabel}
      className="group relative block aspect-square overflow-hidden bg-[#e7eaee] sm:rounded-[10px]"
    >
      {item.type === "image" ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={item.url}
          alt=""
          loading="lazy"
          className="size-full object-cover transition duration-500 group-hover:scale-[1.03]"
        />
      ) : item.type === "video" ? (
        <>
          <video
            src={`${item.url}#t=0.1`}
            muted
            playsInline
            preload="metadata"
            onLoadedMetadata={(e) => setDuration(e.currentTarget.duration)}
            className="size-full object-cover"
          />
          <span className="absolute bottom-1.5 start-1.5 flex items-center gap-1 rounded-full bg-black/50 px-2 py-0.5 text-[11px] text-white">
            <Play className="size-2.5" fill="currentColor" aria-hidden />
            {time}
          </span>
        </>
      ) : (
        <>
          <audio
            src={item.url}
            preload="metadata"
            onLoadedMetadata={(e) => setDuration(e.currentTarget.duration)}
            className="hidden"
          />
          <Wave className="size-full bg-[#f5f0e7]" label={time ? `הקלטה · ${time}` : "הקלטה"} />
        </>
      )}
      {label && item.type !== "audio" ? (
        <span className="pointer-events-none absolute inset-0 hidden items-end bg-gradient-to-t from-black/55 via-transparent to-transparent p-2.5 opacity-0 transition group-hover:opacity-100 md:flex">
          <span className="flex min-w-0 items-center gap-1.5 text-[12px] text-white">
            {uploader ? <UserAvatar member={uploader} size="sm" className="size-5 text-[8px]" /> : null}
            <span className="truncate">{label}</span>
          </span>
        </span>
      ) : null}
    </button>
  );
}

function channelTitle(channel: Channel, me: Member, members: Member[]) {
  if (isGuideChannel(channel, members)) return guideChatTitle(channel, me, members);
  if (channel.type !== "dm") return channel.name;
  return dmName(channel.name, channel.memberIds, me.id, (id) => memberById(members, id)?.displayName ?? "");
}

function Lightbox({
  item,
  index,
  list,
  event,
  me,
  members,
  channels,
  onSelect,
  onClose,
  onDelete,
  onShare,
}: {
  item: GalleryItem;
  index: number;
  list: GalleryItem[];
  event?: Gathering;
  me: Member;
  members: Member[];
  channels: Channel[];
  onSelect: (id: string) => void;
  onClose: () => void;
  onDelete: (item: GalleryItem) => Promise<void>;
  onShare: (channel: Channel, label: string) => Promise<void>;
}) {
  const [confirm, setConfirm] = useState(false);
  const [busy, setBusy] = useState(false);
  const touchX = useRef<number | null>(null);
  const prev = list[index - 1];
  const next = list[index + 1];
  const uploader = memberById(members, item.uploadedBy);
  const thumbStart = Math.max(0, Math.min(index - 4, list.length - 9));
  const thumbs = list.slice(thumbStart, thumbStart + 9);
  const writable = channels.filter(
    (c) =>
      canSeeChannel(me, c) &&
      (isGeneralChannel(c) || c.type !== "announcements" || can(me, "postAnnouncement"))
  );

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
      if (e.key === "ArrowLeft" && next) onSelect(next.id);
      if (e.key === "ArrowRight" && prev) onSelect(prev.id);
    };
    window.addEventListener("keydown", onKey);
    const overflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      window.removeEventListener("keydown", onKey);
      document.body.style.overflow = overflow;
    };
  }, [next, prev, onClose, onSelect]);

  async function run(task: () => Promise<void>, error: string) {
    setBusy(true);
    try {
      await task();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : error);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label={item.caption || item.eventLabel}
      className="fixed inset-0 z-50 flex flex-col bg-[#0f1114] md:grid md:grid-cols-[1fr_19rem]"
    >
      <div
        className="relative flex min-h-0 flex-1 flex-col px-3 pb-3 pt-14 md:px-16 md:pb-4 md:pt-6"
        onTouchStart={(e) => {
          touchX.current = e.touches[0]?.clientX ?? null;
        }}
        onTouchEnd={(e) => {
          const start = touchX.current;
          touchX.current = null;
          const end = e.changedTouches[0]?.clientX;
          if (start === null || end === undefined) return;
          const dx = end - start;
          if (dx > 50 && next) onSelect(next.id);
          if (dx < -50 && prev) onSelect(prev.id);
        }}
      >
        <button
          type="button"
          onClick={onClose}
          aria-label="סגירה"
          className="absolute end-3 top-3 grid size-9 place-items-center rounded-full bg-white/12 text-white hover:bg-white/20 md:end-5 md:top-5"
        >
          <X className="size-4" />
        </button>
        <div className="flex min-h-0 flex-1 items-center justify-center" onClick={onClose}>
          <div onClick={(e) => e.stopPropagation()} className="flex max-h-full max-w-full">
            {item.type === "image" ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={item.url}
                alt={item.caption || item.eventLabel}
                className="max-h-[calc(100dvh-16rem)] max-w-full rounded-[6px] object-contain md:max-h-[calc(100dvh-8.5rem)]"
              />
            ) : item.type === "video" ? (
              <video
                src={item.url}
                controls
                autoPlay
                playsInline
                className="max-h-[calc(100dvh-16rem)] max-w-full rounded-[6px] md:max-h-[calc(100dvh-8.5rem)]"
              />
            ) : (
              <div className="rounded-2xl bg-[#fbfcfd] px-6 py-8">
                <VoiceNotePlayer src={item.url} />
              </div>
            )}
          </div>
        </div>
        {prev ? (
          <NavArrow side="prev" onClick={() => onSelect(prev.id)} />
        ) : null}
        {next ? (
          <NavArrow side="next" onClick={() => onSelect(next.id)} />
        ) : null}
        {thumbs.length > 1 ? (
          <div className="mt-3 flex justify-center gap-1.5 overflow-x-auto">
            {thumbs.map((thumb) => (
              <button
                key={thumb.id}
                type="button"
                onClick={() => onSelect(thumb.id)}
                className={cn(
                  "size-11 shrink-0 overflow-hidden rounded-[6px] transition md:size-12",
                  thumb.id === item.id ? "opacity-100 outline-2 outline-offset-1 outline-white" : "opacity-40 hover:opacity-70"
                )}
              >
                <Thumb item={thumb} />
              </button>
            ))}
          </div>
        ) : null}
      </div>

      <aside className="max-h-[42dvh] shrink-0 space-y-4 overflow-y-auto rounded-t-[20px] bg-[#fbfcfd] px-5 py-5 md:max-h-none md:rounded-none md:px-6 md:py-7">
        <div>
          <p className="truncate text-[12px] font-light text-primary/85">
            {index + 1} מתוך {list.length} · {item.eventLabel}
          </p>
          <h2 className="mt-1 text-[17px] font-normal leading-snug md:text-[19px]">
            {item.caption?.trim() || item.eventLabel}
          </h2>
        </div>
        {uploader ? (
          <div className="flex items-center gap-2.5">
            <UserAvatar member={uploader} size="sm" />
            <div className="text-[13px] leading-tight">
              {uploader.displayName}
              <div className="text-[11px] font-light text-muted-foreground">
                העלה {formatRelativeHe(item.createdAt)}
              </div>
            </div>
          </div>
        ) : null}
        {event ? (
          <div className="space-y-1 border-t border-[#e7eaee] pt-3.5 text-[13px] font-light">
            <div className="text-[11px] text-muted-foreground">חברה</div>
            <Link href={`/journal/${event.id}`} className="block text-foreground/80 hover:text-primary">
              {gatheringLabel(event)}
            </Link>
            <div className="text-muted-foreground">{formatHebrewDate(event.startsAt)}</div>
          </div>
        ) : null}
        <div className="flex flex-wrap gap-2 border-t border-[#e7eaee] pt-3.5">
          <a
            href={item.url}
            download
            target="_blank"
            rel="noreferrer"
            className="inline-flex items-center gap-1.5 rounded-full border border-[#dfe3e8] px-3.5 py-1.5 text-[13px] text-foreground/75 hover:text-foreground"
          >
            <Download className="size-3.5" aria-hidden />
            הורדה
          </a>
          {writable.length && can(me, "chat") ? (
            <DropdownMenu dir="rtl">
              <DropdownMenuTrigger
                disabled={busy}
                className="inline-flex items-center gap-1.5 rounded-full border border-[#dfe3e8] px-3.5 py-1.5 text-[13px] text-foreground/75 outline-none hover:text-foreground"
              >
                <Send className="size-3.5" aria-hidden />
                שיתוף לצ׳אט
              </DropdownMenuTrigger>
              <DropdownMenuContent align="start" className="z-[60] w-auto min-w-44">
                {writable.map((channel) => {
                  const label = channelTitle(channel, me, members);
                  return (
                    <DropdownMenuItem
                      key={channel.id}
                      className="whitespace-nowrap"
                      onSelect={() => void run(() => onShare(channel, label), "השליחה נכשלה")}
                    >
                      {label}
                    </DropdownMenuItem>
                  );
                })}
              </DropdownMenuContent>
            </DropdownMenu>
          ) : null}
          {canDeleteMedia(me, item) && !confirm ? (
            <button
              type="button"
              onClick={() => setConfirm(true)}
              className="inline-flex items-center gap-1.5 rounded-full border border-destructive/20 px-3.5 py-1.5 text-[13px] text-destructive/85 hover:text-destructive"
            >
              <Trash2 className="size-3.5" aria-hidden />
              מחיקה
            </button>
          ) : null}
        </div>
        {confirm ? (
          <div className="rounded-xl bg-destructive/8 px-3.5 py-3">
            <p className="text-[13px]">למחוק את הפריט?</p>
            <p className="mt-0.5 text-[12px] font-light text-muted-foreground">
              {item.uploadedBy === me.id ? "הוא יוסר מהגלריה." : "זו מדיה של חבר — היא תוסר מהגלריה."}
            </p>
            <div className="mt-2.5 flex gap-2">
              <Button
                type="button"
                variant="destructive"
                size="sm"
                className="rounded-full"
                disabled={busy}
                onClick={() => void run(() => onDelete(item), "המחיקה נכשלה")}
              >
                {busy ? "מוחק…" : "מחיקה"}
              </Button>
              <Button type="button" variant="ghost" size="sm" className="rounded-full" onClick={() => setConfirm(false)}>
                ביטול
              </Button>
            </div>
          </div>
        ) : null}
      </aside>
    </div>
  );
}

function NavArrow({ side, onClick }: { side: "prev" | "next"; onClick: () => void }) {
  const Icon = side === "prev" ? ChevronRight : ChevronLeft;
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={side === "prev" ? "הקודם" : "הבא"}
      className={cn(
        "absolute top-1/2 hidden size-10 -translate-y-1/2 place-items-center rounded-full bg-white/12 text-white hover:bg-white/20 md:grid",
        side === "prev" ? "start-4" : "end-4"
      )}
    >
      <Icon className="size-5" />
    </button>
  );
}

type Picked = LocalUpload & { progress: number };

function UploadDialog({
  open,
  onOpenChange,
  events,
  defaultEventId,
  onUpload,
  me,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  events: Gathering[];
  defaultEventId: string;
  onUpload: (media: EventMedia, eventId: string) => Promise<void>;
  me: Member;
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [files, setFiles] = useState<Picked[]>([]);
  const [eventId, setEventId] = useState(defaultEventId);
  const [caption, setCaption] = useState("");
  const [busy, setBusy] = useState(false);
  const [dragging, setDragging] = useState(false);
  const options = events
    .filter((event) => event.status !== "cancelled")
    .sort((a, b) => +new Date(b.startsAt) - +new Date(a.startsAt));

  function reset() {
    files.forEach((file) => URL.revokeObjectURL(file.previewUrl));
    setFiles([]);
    setCaption("");
  }

  function add(list: FileList | null) {
    if (!list) return;
    const next = [...list]
      .map((file) => ({ ...createLocalUpload(file), progress: 0 }))
      .filter((file) => file.type !== "file");
    if (next.length < list.length) toast.message("אפשר להעלות רק תמונות, סרטונים והקלטות");
    setFiles((prev) => [...prev, ...next]);
  }

  async function submit() {
    if (!files.length || busy) return;
    setBusy(true);
    let done = 0;
    try {
      for (const file of files) {
        const data = await uploadWithProgress(file.file, {}, ({ percent }) => {
          setFiles((prev) => prev.map((f) => (f.id === file.id ? { ...f, progress: percent } : f)));
        });
        await preloadMedia(data.url, file.type);
        await onUpload(
          {
            id: crypto.randomUUID(),
            type: file.type as EventMedia["type"],
            url: data.url,
            caption: caption.trim() || undefined,
            uploadedBy: me.id,
            createdAt: new Date().toISOString(),
          },
          eventId
        );
        done += 1;
        setFiles((prev) => prev.map((f) => (f.id === file.id ? { ...f, progress: 100 } : f)));
      }
      toast.success(done === 1 ? "הפריט נוסף לגלריה" : `${done} פריטים נוספו לגלריה`);
      reset();
      onOpenChange(false);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "העלאה נכשלה");
      setFiles((prev) => prev.slice(done));
    } finally {
      setBusy(false);
    }
  }

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        if (busy) return;
        if (next) setEventId(defaultEventId);
        else reset();
        onOpenChange(next);
      }}
    >
      <DialogContent
        dir="rtl"
        className="gap-4 rounded-[1.4rem] bg-[#fbfcfd] p-5 sm:max-w-md max-sm:top-auto max-sm:bottom-0 max-sm:max-w-full max-sm:translate-y-0 max-sm:rounded-b-none max-sm:pb-8"
      >
        <DialogTitle className="text-[17px] font-normal">העלאה לגלריה</DialogTitle>
        <input
          ref={inputRef}
          type="file"
          multiple
          accept="image/*,video/*,audio/*"
          className="hidden"
          onChange={(e) => {
            add(e.target.files);
            e.target.value = "";
          }}
        />
        <button
          type="button"
          disabled={busy}
          onClick={() => inputRef.current?.click()}
          onDragOver={(e) => {
            e.preventDefault();
            setDragging(true);
          }}
          onDragLeave={() => setDragging(false)}
          onDrop={(e) => {
            e.preventDefault();
            setDragging(false);
            add(e.dataTransfer.files);
          }}
          className={cn(
            "grid justify-items-center gap-1.5 rounded-2xl border-[1.5px] border-dashed px-4 py-6 text-center text-[13px] font-light text-muted-foreground transition",
            dragging ? "border-primary bg-primary/5" : "border-[#cfd5dd] hover:border-[#b9c1cb]"
          )}
        >
          <Upload className="size-6 text-primary" aria-hidden />
          <span>
            גררו לכאן תמונות, סרטונים או הקלטות
            <br />
            או לחצו לבחירה — אפשר כמה ביחד
          </span>
        </button>
        {files.length ? (
          <div className="flex flex-wrap gap-1.5">
            {files.map((file) => (
              <div key={file.id} className="relative size-14 overflow-hidden rounded-lg bg-[#eef0f3]">
                {file.type === "image" ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={file.previewUrl} alt="" className="size-full object-cover" />
                ) : file.type === "video" ? (
                  <video src={file.previewUrl} muted playsInline className="size-full object-cover" />
                ) : (
                  <Wave className="size-full bg-[#f5f0e7] [&>div]:scale-50" />
                )}
                {busy ? (
                  <span className="absolute inset-x-0 bottom-0 h-1 bg-black/20">
                    <span className="block h-full bg-primary" style={{ width: `${file.progress}%` }} />
                  </span>
                ) : (
                  <button
                    type="button"
                    aria-label="הסרה"
                    onClick={() => {
                      URL.revokeObjectURL(file.previewUrl);
                      setFiles((prev) => prev.filter((f) => f.id !== file.id));
                    }}
                    className="absolute end-0.5 top-0.5 grid size-5 place-items-center rounded-full bg-black/55 text-white"
                  >
                    <X className="size-3" />
                  </button>
                )}
              </div>
            ))}
          </div>
        ) : null}
        <label className="grid gap-1.5 text-[12px] font-light text-muted-foreground">
          לאיזו חברה?
          <select
            value={eventId}
            disabled={busy}
            onChange={(e) => setEventId(e.target.value)}
            className="h-10 rounded-xl border border-[#e1e5ea] bg-white px-3 text-[14px] font-normal text-foreground"
          >
            <option value="">ללא שיוך לחברה</option>
            {options.map((event) => (
              <option key={event.id} value={event.id}>
                {gatheringLabel(event)} · {formatDateShortHe(event.startsAt)}
              </option>
            ))}
          </select>
        </label>
        <label className="grid gap-1.5 text-[12px] font-light text-muted-foreground">
          תיאור (לא חובה)
          <input
            value={caption}
            disabled={busy}
            onChange={(e) => setCaption(e.target.value)}
            placeholder="מה רואים כאן?"
            className="h-10 rounded-xl border border-[#e1e5ea] bg-white px-3 text-[14px] font-normal text-foreground"
          />
        </label>
        <Button
          type="button"
          className="h-11 rounded-full"
          disabled={!files.length || busy}
          onClick={() => void submit()}
        >
          {busy
            ? "מעלה…"
            : files.length > 1
              ? `העלאת ${files.length} פריטים`
              : files.length
                ? "העלאת פריט"
                : "בחרו קבצים"}
        </Button>
      </DialogContent>
    </Dialog>
  );
}
