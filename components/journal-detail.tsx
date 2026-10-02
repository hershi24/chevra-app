"use client";

import { use, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ArrowLeft, ArrowRight, Mic, Pencil, Play, Plus, Trash2, X } from "lucide-react";
import { toast } from "sonner";
import { useApp } from "@/components/app-provider";
import { EventDialog } from "@/components/event-dialog";
import { MediaProgressOverlay } from "@/components/media-progress";
import { UserAvatar } from "@/components/user-avatar";
import { VoiceNotePlayer } from "@/components/voice-note-player";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import {
  formatDateHe,
  formatHebrewDate,
  formatTimeHe,
  journalHeading,
  memberById,
  rsvpLabel,
  splitGatheringTitle,
} from "@/lib/format";
import { can, isAdmin } from "@/lib/permissions";
import { gatheringHeld } from "@/lib/selectors";
import type { EventMedia, Gathering, Member, RsvpStatus } from "@/lib/types";
import { createLocalUpload, preloadMedia, uploadWithProgress } from "@/lib/upload-client";
import { cn } from "@/lib/utils";

type PendingMedia = {
  id: string;
  previewUrl: string;
  type: "image" | "video" | "audio" | "file";
  progress: number;
  remainingSeconds: number | null;
  name: string;
};

const rsvpChoices: { status: RsvpStatus; label: string }[] = [
  { status: "yes", label: "מגיע" },
  { status: "maybe", label: "אולי" },
  { status: "no", label: "לא מגיע" },
];

function Credit({ label, member }: { label: string; member?: Member }) {
  if (!member) return null;
  return (
    <div className="flex items-center gap-2.5 rounded-[18px] bg-white p-3.5 shadow-[0_1px_2px_rgba(15,23,42,.04)]">
      <UserAvatar member={member} />
      <div>
        <small className="block text-[11.5px] font-light text-[#a9782c]">{label}</small>
        <span className="text-[14px]">{member.displayName}</span>
      </div>
    </div>
  );
}

function NeighborCard({ event, label }: { event?: Gathering; label: string }) {
  if (!event) return <div className="hidden md:block" />;
  const cover = event.media.find((m) => m.type === "image");
  return (
    <Link
      href={`/journal/${event.id}`}
      className="relative block h-[120px] overflow-hidden rounded-[20px] bg-linear-to-br from-[#3b2f1e] to-[#8a5f1c] text-white"
    >
      {cover ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={cover.url} alt="" className="h-full w-full object-cover" />
      ) : null}
      <div className="absolute inset-0 flex flex-col justify-end bg-black/45 px-5 py-4">
        <small className="text-[12px] font-light opacity-85">
          {label} · {formatHebrewDate(event.startsAt)}
        </small>
        <b className="truncate text-[17px] font-medium">{splitGatheringTitle(event).heading}</b>
      </div>
    </Link>
  );
}

export function JournalDetail({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = use(params);
  const router = useRouter();
  const { state, me, act } = useApp();
  const [summary, setSummary] = useState<string | null>(null);
  const [editingSummary, setEditingSummary] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [pending, setPending] = useState<PendingMedia[]>([]);
  const [showAll, setShowAll] = useState(false);
  const [viewer, setViewer] = useState<number | null>(null);
  const [rsvping, setRsvping] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);
  const pendingRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!pending.length) return;
    pendingRef.current?.scrollIntoView({ behavior: "auto", block: "center" });
  }, [pending.length]);

  const event = state?.gatherings.find((g) => g.id === id);
  const visual = [...(event?.media.filter((m) => m.type === "image" || m.type === "video") ?? [])].sort(
    (a, b) => Number(a.url.startsWith("/")) - Number(b.url.startsWith("/"))
  );
  const visualCount = visual.length;

  useEffect(() => {
    if (viewer === null) return;
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") setViewer(null);
      if (e.key === "ArrowLeft") setViewer((v) => (v === null ? v : (v + 1) % visualCount));
      if (e.key === "ArrowRight") setViewer((v) => (v === null ? v : (v - 1 + visualCount) % visualCount));
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [viewer, visualCount]);

  if (!state || !me) return null;
  if (!event) {
    return (
      <div className="p-6">
        החברה לא נמצאה. <Link href="/journal" className="underline">חזרה ליומן</Link>
      </div>
    );
  }

  const host = memberById(state.members, event.hostId);
  const lecturer = memberById(state.members, event.lecturerId);
  const kibud = memberById(state.members, event.kibudId);
  const currentSummary = summary ?? event.summary ?? "";
  const { kind } = splitGatheringTitle(event);
  const heading = journalHeading(event);
  const held = gatheringHeld(event);
  const isUpcoming = event.status === "upcoming" && !held;
  const cover =
    event.media.find((m) => m.type === "image" && m.url.startsWith("http")) ??
    event.media.find((m) => m.type === "image");
  const audios = event.media.filter((m) => m.type === "audio");
  const coming = state.members.filter((m) => event.rsvps[m.id] === "yes");
  const mine = event.rsvps[me.id] ?? "pending";
  const photographers = [
    ...new Set(event.media.map((m) => memberById(state.members, m.uploadedBy)?.displayName).filter(Boolean)),
  ];
  const ordered = [...state.gatherings].sort((a, b) => +new Date(a.startsAt) - +new Date(b.startsAt));
  const position = ordered.findIndex((g) => g.id === event.id);
  const newer = ordered[position + 1];
  const older = ordered[position - 1];
  const mosaic = visual.slice(0, 5);
  const canEditSummary = can(me, "uploadSummary");

  const gathering = event;
  const user = me;

  async function uploadFiles(files: FileList | null) {
    if (!files?.length) return;
    const items = Array.from(files).map((file) => createLocalUpload(file));
    setPending((prev) => [
      ...prev,
      ...items.map((item) => ({
        id: item.id,
        previewUrl: item.previewUrl,
        type: item.type,
        progress: 0,
        remainingSeconds: null,
        name: item.name,
      })),
    ]);
    if (fileRef.current) fileRef.current.value = "";

    const results = await Promise.all(
      items.map(async (item) => {
        try {
          const data = await uploadWithProgress(
            item.file,
            { gatheringId: gathering.id },
            ({ percent, remainingSeconds }) => {
              setPending((prev) =>
                prev.map((p) =>
                  p.id === item.id ? { ...p, progress: percent, remainingSeconds } : p
                )
              );
            }
          );
          const type: EventMedia["type"] =
            item.type === "video" ? "video" : item.type === "audio" ? "audio" : "image";
          await preloadMedia(data.url, item.type);
          await act({
            type: "uploadMedia",
            eventId: gathering.id,
            media: {
              id: crypto.randomUUID(),
              type,
              url: data.url,
              caption: item.name,
              uploadedBy: user.id,
              createdAt: new Date().toISOString(),
            },
          });
          return true;
        } catch (error) {
          toast.error(error instanceof Error ? error.message : "העלאה נכשלה");
          return false;
        } finally {
          URL.revokeObjectURL(item.previewUrl);
          setPending((prev) => prev.filter((p) => p.id !== item.id));
        }
      })
    );
    if (results.some(Boolean)) toast.success("המדיה נוספה ליומן");
  }

  async function saveSummary() {
    try {
      await act({ type: "saveSummary", eventId: gathering.id, summary: currentSummary });
      toast.success("הסיכום נשמר");
      setEditingSummary(false);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "השמירה נכשלה");
    }
  }

  async function setRsvp(status: RsvpStatus) {
    if (rsvping) return;
    setRsvping(true);
    try {
      await act({ type: "rsvp", eventId: gathering.id, status });
      toast.success(`נשמר: ${rsvpLabel(status)}`);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "השמירה נכשלה");
    } finally {
      setRsvping(false);
    }
  }

  function thumb(item: EventMedia, className?: string) {
    return item.type === "video" ? (
      <span className={cn("relative block h-full w-full bg-black", className)}>
        <video src={item.url} preload="metadata" muted playsInline className="h-full w-full object-cover" />
        <span className="absolute inset-0 grid place-items-center">
          <span className="grid size-11 place-items-center rounded-full bg-black/55 text-white">
            <Play className="size-5 fill-current" />
          </span>
        </span>
      </span>
    ) : (
      // eslint-disable-next-line @next/next/no-img-element
      <img src={item.url} alt={item.caption ?? ""} className={cn("h-full w-full object-cover", className)} />
    );
  }

  const viewing = viewer === null ? null : visual[viewer];

  return (
    <div className="-mx-5 -mt-6 -mb-28 bg-[#faf8f4] pb-28 md:-mx-8 md:-mt-10 md:-mb-16 md:pb-16">
      <section className="relative h-[300px] overflow-hidden bg-linear-to-br from-[#3b2f1e] to-[#8a5f1c] md:h-[380px]">
        {cover ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={cover.url} alt="" className="h-full w-full object-cover" />
        ) : null}
        <div className="absolute inset-0 bg-linear-to-t from-[rgba(20,16,10,.85)] to-[rgba(20,16,10,.1)] to-65%" />
        <Link
          href="/journal"
          className="absolute top-4 right-5 inline-flex items-center gap-1 rounded-full bg-black/35 px-3 py-1.5 text-[13px] font-light text-white backdrop-blur-sm md:right-8"
        >
          <ArrowRight className="size-4" />
          יומן החבורה
        </Link>
        {isAdmin(me) ? (
          <div className="absolute top-4 left-5 flex gap-1.5 md:left-8">
            <EventDialog
              event={event}
              trigger={
                <button
                  type="button"
                  className="inline-flex items-center gap-1 rounded-full bg-white/90 px-3 py-1.5 text-[12.5px] text-[#1f2328]"
                >
                  <Pencil className="size-3.5" />
                  עריכה
                </button>
              }
            />
            <button
              type="button"
              className="inline-flex items-center gap-1 rounded-full bg-white/90 px-3 py-1.5 text-[12.5px] text-[#c2410c]"
              onClick={() => setConfirmDelete(true)}
            >
              <Trash2 className="size-3.5" />
              מחיקה
            </button>
          </div>
        ) : null}
        <div className="absolute inset-x-0 bottom-0 mx-auto max-w-[1120px] px-5 pb-7 text-white md:px-8 md:pb-[34px]">
          <div className="text-[12.5px] font-light tracking-[.04em] text-[#f1d9a8]">
            {[kind, formatHebrewDate(event.startsAt), formatDateHe(event.startsAt), formatTimeHe(event.startsAt)]
              .filter(Boolean)
              .join(" · ")}
          </div>
          <h1 className="mt-2 text-[1.9rem] leading-tight font-medium md:text-[40px]">{heading}</h1>
          {held ? <p className="mt-2 text-[14px] font-medium text-[#f1d9a8]">התקיימה</p> : null}
          <div className="mt-2.5 flex flex-wrap gap-x-[18px] gap-y-1 text-[14px] font-light opacity-90">
            {event.location ? <span>{event.location}</span> : null}
            {coming.length ? <span>{coming.length} {isUpcoming ? "מגיעים" : "השתתפו"}</span> : null}
            {visual.length ? <span>{visual.length} תמונות וסרטונים</span> : null}
            {event.status === "cancelled" ? <span>בוטלה</span> : null}
          </div>
        </div>
      </section>

      <div className="mx-auto max-w-[720px] px-5 pt-8 md:px-8">
        {host || lecturer || kibud ? (
          <div className="grid gap-3 sm:grid-cols-3">
            <Credit label="מארח" member={host} />
            <Credit label="מעביר השיעור" member={lecturer} />
            <Credit label="כיבוד" member={kibud} />
          </div>
        ) : null}

        {isUpcoming && can(me, "rsvp") ? (
          <div className="mt-6 rounded-[22px] bg-[#fffaf0] p-4 ring-1 ring-[#ecdcbc] md:px-5">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <b className="block text-[15px] font-medium">מגיעים?</b>
                <span className="text-[12.5px] font-light text-muted-foreground">
                  {coming.length ? `${coming.length} כבר אישרו הגעה` : "עדיין אף אחד לא אישר"}
                </span>
              </div>
              <div className="flex gap-1.5">
                {rsvpChoices.map((choice) => (
                  <Button
                    key={choice.status}
                    type="button"
                    size="sm"
                    variant={mine === choice.status ? "default" : "outline"}
                    className="rounded-full px-4"
                    disabled={rsvping}
                    onClick={() => void setRsvp(choice.status)}
                  >
                    {choice.label}
                  </Button>
                ))}
              </div>
            </div>
          </div>
        ) : null}

        {editingSummary ? (
          <div className="mt-8 space-y-3">
            <Textarea
              rows={7}
              value={currentSummary}
              onChange={(e) => setSummary(e.target.value)}
              placeholder="סיכום קצר, מקורות, נקודות להמשך…"
              className="bg-white text-[16px] leading-8"
            />
            <div className="flex gap-2">
              <Button onClick={() => void saveSummary()}>שמירת סיכום</Button>
              <Button
                variant="ghost"
                onClick={() => {
                  setSummary(null);
                  setEditingSummary(false);
                }}
              >
                ביטול
              </Button>
            </div>
          </div>
        ) : currentSummary ? (
          <div className="mt-8">
            <p className="text-[17px] leading-[1.9] font-light whitespace-pre-wrap text-[#1f2328] md:text-[19px]">
              {currentSummary}
            </p>
            {canEditSummary ? (
              <button
                type="button"
                className="mt-2 inline-flex items-center gap-1 text-[13px] font-light text-[#8a5f1c]"
                onClick={() => setEditingSummary(true)}
              >
                <Pencil className="size-3.5" />
                עריכת הסיכום
              </button>
            ) : null}
          </div>
        ) : (
          <div className="mt-8 text-[15px] leading-8 font-light text-muted-foreground">
            {isUpcoming && event.notes ? (
              <p className="whitespace-pre-wrap text-[#1f2328]">{event.notes}</p>
            ) : (
              <p>עדיין אין סיכום לחברה זו.</p>
            )}
            {canEditSummary ? (
              <button
                type="button"
                className="mt-1 inline-flex items-center gap-1 text-[13px] text-[#8a5f1c]"
                onClick={() => setEditingSummary(true)}
              >
                <Plus className="size-3.5" />
                הוספת סיכום
              </button>
            ) : null}
          </div>
        )}

        {event.audioUrl || audios.length ? (
          <div className="my-6 space-y-2">
            {[
              ...(event.audioUrl ? [{ id: "lesson", url: event.audioUrl, name: lecturer?.displayName }] : []),
              ...audios.map((a) => ({
                id: a.id,
                url: a.url,
                name: memberById(state.members, a.uploadedBy)?.displayName,
              })),
            ].map((track, index) => (
              <div
                key={track.id}
                className="flex flex-col gap-3 rounded-[22px] bg-[#1f2328] px-4 py-4 text-white sm:flex-row sm:items-center md:px-5"
              >
                <div className="flex items-center gap-3 sm:w-44 sm:shrink-0">
                  <span className="grid size-11 shrink-0 place-items-center rounded-full bg-[#b8862f]">
                    <Mic className="size-5" />
                  </span>
                  <div>
                    <b className="block text-[15px] font-medium">
                      {index === 0 && event.audioUrl ? "הקלטת השיעור" : "הקלטה"}
                    </b>
                    {track.name ? <small className="text-[12px] font-light opacity-70">{track.name}</small> : null}
                  </div>
                </div>
                <VoiceNotePlayer src={track.url} tone="dark" className="min-w-0 flex-1" />
              </div>
            ))}
          </div>
        ) : null}
      </div>

      <div className="mx-auto mt-8 max-w-[1120px] px-5 md:px-8">
        {visual.length ? (
          showAll ? (
            <div className="grid grid-cols-2 gap-2.5 md:grid-cols-4">
              {visual.map((item, index) => (
                <button
                  key={item.id}
                  type="button"
                  className="aspect-square overflow-hidden rounded-[18px]"
                  onClick={() => setViewer(index)}
                >
                  {thumb(item)}
                </button>
              ))}
            </div>
          ) : (
            <div
              className={cn(
                "grid gap-2.5",
                mosaic.length === 1 && "h-[260px] grid-cols-1 md:h-[410px]",
                mosaic.length === 2 && "h-[220px] grid-cols-2 md:h-[410px]",
                mosaic.length > 2 && "grid-cols-2 grid-rows-[200px_120px] md:grid-rows-[200px_200px]",
                mosaic.length === 3 && "md:grid-cols-[2fr_1fr]",
                mosaic.length > 3 && "md:grid-cols-[2fr_1fr_1fr]"
              )}
            >
              {mosaic.map((item, index) => (
                <button
                  key={item.id}
                  type="button"
                  className={cn(
                    "relative overflow-hidden rounded-[18px]",
                    mosaic.length > 2 && index === 0 && "col-span-2 md:col-span-1 md:row-span-2",
                    index > 2 && "hidden md:block",
                    mosaic.length === 4 && index === 3 && "md:col-span-2"
                  )}
                  onClick={() => setViewer(index)}
                >
                  {thumb(item)}
                  {mosaic.length > 2 && index === 2 && visual.length > 3 ? (
                    <span className="absolute inset-0 grid place-items-center bg-black/50 text-[15px] text-white md:hidden">
                      +{visual.length - 3}
                    </span>
                  ) : null}
                  {index === mosaic.length - 1 && visual.length > mosaic.length ? (
                    <span className="absolute inset-0 hidden place-items-center bg-black/50 text-[16px] text-white md:grid">
                      +{visual.length - mosaic.length} · לכל התמונות
                    </span>
                  ) : null}
                </button>
              ))}
            </div>
          )
        ) : pending.length === 0 ? (
          <div className="rounded-[22px] bg-white py-10 text-center text-[14px] font-light text-muted-foreground">
            עדיין אין תמונות מהחברה הזאת.
          </div>
        ) : null}

        {pending.length ? (
          <div className="mt-2.5 grid gap-2.5 md:grid-cols-2">
            {pending.map((item, index) => (
              <figure
                key={item.id}
                ref={index === pending.length - 1 ? pendingRef : undefined}
                className="overflow-hidden rounded-[18px] bg-black/90"
              >
                <MediaProgressOverlay
                  src={item.previewUrl}
                  type={item.type}
                  progress={item.progress}
                  remainingSeconds={item.remainingSeconds}
                  name={item.name}
                  onReady={() => pendingRef.current?.scrollIntoView({ behavior: "auto", block: "center" })}
                />
              </figure>
            ))}
          </div>
        ) : null}

        <div className="mt-3.5 flex flex-wrap items-center justify-between gap-2 text-[13px]">
          <span className="font-light text-muted-foreground">
            {photographers.length ? `צולם על ידי ${photographers.join(", ")}` : ""}
          </span>
          <span className="flex items-center gap-3">
            {visual.length > 3 || showAll ? (
              <button type="button" className="font-light text-[#4b5563]" onClick={() => setShowAll((v) => !v)}>
                {showAll ? "תצוגה מקוצרת" : `לכל ${visual.length} התמונות`}
              </button>
            ) : null}
            {can(me, "uploadMedia") ? (
              <>
                <input
                  ref={fileRef}
                  type="file"
                  accept="image/*,video/*,audio/*"
                  multiple
                  className="hidden"
                  onChange={(e) => void uploadFiles(e.target.files)}
                />
                <button
                  type="button"
                  className="inline-flex items-center gap-1 text-[#8a5f1c]"
                  onClick={() => fileRef.current?.click()}
                >
                  <Plus className="size-4" />
                  הוספת תמונות
                </button>
              </>
            ) : null}
          </span>
        </div>
      </div>

      {held ? (
        <div className="mx-auto mt-9 max-w-[720px] px-5 text-center md:px-8">
          <h3 className="mb-3 text-[15px] font-medium">מי השתתף</h3>
          {coming.length ? (
            <span className="inline-flex -space-x-2.5">
              {coming.map((m) => (
                <UserAvatar key={m.id} member={m} size="lg" className="ring-[3px] ring-background" />
              ))}
            </span>
          ) : null}
          <p className="mt-3 text-[15px] leading-7 font-light text-[#1f2328]">
            {coming.length
              ? `השתתפו: ${coming.map((member) => member.displayName).join(", ")}`
              : "לא סומנו משתתפים"}
          </p>
        </div>
      ) : isUpcoming && coming.length ? (
        <div className="mx-auto mt-9 max-w-[720px] px-5 text-center md:px-8">
          <h3 className="mb-3 text-[15px] font-medium">מי מגיע</h3>
          <span className="inline-flex -space-x-2.5">
            {coming.map((m) => (
              <UserAvatar key={m.id} member={m} size="lg" className="ring-[3px] ring-background" />
            ))}
          </span>
        </div>
      ) : null}

      {can(me, "viewRsvps") ? (
        <div className="mx-auto mt-9 max-w-[720px] px-5 md:px-8">
          <h3 className="mb-3 text-[15px] font-medium">אישורי הגעה</h3>
          <div className="grid gap-2 sm:grid-cols-2">
            {state.members.map((member) => (
              <div key={member.id} className="flex items-center justify-between rounded-xl bg-white px-3 py-2 text-[14px]">
                <span className="flex items-center gap-2">
                  <UserAvatar member={member} size="sm" />
                  {member.displayName}
                </span>
                <span className="text-xs font-light text-muted-foreground">
                  {rsvpLabel(event.rsvps[member.id] ?? "pending")}
                </span>
              </div>
            ))}
          </div>
        </div>
      ) : null}

      {newer || older ? (
        <div className="mx-auto mt-10 grid max-w-[1120px] gap-4 px-5 md:grid-cols-2 md:px-8">
          <NeighborCard event={newer} label="← החברה הבאה" />
          <NeighborCard event={older} label="החברה הקודמת →" />
        </div>
      ) : null}

      {viewing ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/90" onClick={() => setViewer(null)}>
          <button type="button" className="absolute top-4 left-4 text-white/80" onClick={() => setViewer(null)}>
            <X className="size-7" />
          </button>
          {visual.length > 1 ? (
            <>
              <button
                type="button"
                className="absolute right-3 grid size-11 place-items-center rounded-full bg-white/10 text-white"
                onClick={(e) => {
                  e.stopPropagation();
                  setViewer((v) => (v === null ? v : (v - 1 + visual.length) % visual.length));
                }}
              >
                <ArrowRight className="size-5" />
              </button>
              <button
                type="button"
                className="absolute left-3 grid size-11 place-items-center rounded-full bg-white/10 text-white"
                onClick={(e) => {
                  e.stopPropagation();
                  setViewer((v) => (v === null ? v : (v + 1) % visual.length));
                }}
              >
                <ArrowLeft className="size-5" />
              </button>
            </>
          ) : null}
          <div className="max-h-[88vh] max-w-[92vw]" onClick={(e) => e.stopPropagation()}>
            {viewing.type === "video" ? (
              <video src={viewing.url} controls autoPlay playsInline className="max-h-[88vh] max-w-[92vw]" />
            ) : (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={viewing.url} alt={viewing.caption ?? ""} className="max-h-[88vh] max-w-[92vw] object-contain" />
            )}
            <div className="mt-2 text-center text-[13px] font-light text-white/70">
              {memberById(state.members, viewing.uploadedBy)?.displayName}
              {visual.length > 1 ? ` · ${(viewer ?? 0) + 1}/${visual.length}` : ""}
            </div>
          </div>
        </div>
      ) : null}

      {confirmDelete ? (
        <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/45 p-4 md:items-center">
          <div role="dialog" aria-modal="true" className="w-full max-w-md rounded-2xl bg-white p-4 shadow-2xl">
            <h2 className="text-base font-medium">למחוק את החברה?</h2>
            <p className="mt-1 text-sm font-light leading-6 text-muted-foreground">
              החברה תוסר מהיומן. המדיה בגלריה נשארת.
            </p>
            <div className="mt-4 flex gap-2">
              <Button
                type="button"
                variant="destructive"
                className="h-11 flex-1 rounded-xl"
                disabled={deleting}
                onClick={() => {
                  setDeleting(true);
                  void act({ type: "deleteGathering", eventId: event.id })
                    .then(() => {
                      toast.success("החברה נמחקה");
                      router.push("/journal");
                    })
                    .catch((error: unknown) => {
                      toast.error(error instanceof Error ? error.message : "המחיקה נכשלה");
                      setDeleting(false);
                    });
                }}
              >
                {deleting ? "מוחק…" : "מחק"}
              </Button>
              <Button
                type="button"
                variant="outline"
                className="h-11 flex-1 rounded-xl"
                disabled={deleting}
                onClick={() => setConfirmDelete(false)}
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
