"use client";

import { use, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { ArrowRight, Upload } from "lucide-react";
import { toast } from "sonner";
import { useApp } from "@/components/app-provider";
import { MediaProgressOverlay } from "@/components/media-progress";
import { UserAvatar } from "@/components/user-avatar";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Textarea } from "@/components/ui/textarea";
import {
  formatDateTimeHe,
  gatheringLabel,
  gatheringTitle,
  memberById,
  rsvpLabel,
} from "@/lib/format";
import { can } from "@/lib/permissions";
import type { EventMedia } from "@/lib/types";
import { createLocalUpload, uploadWithProgress } from "@/lib/upload-client";

type PendingMedia = {
  id: string;
  previewUrl: string;
  type: "image" | "video" | "audio" | "file";
  progress: number;
  remainingSeconds: number | null;
  name: string;
};

export function JournalDetail({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = use(params);
  const { state, me, act } = useApp();
  const [summary, setSummary] = useState<string | null>(null);
  const [pending, setPending] = useState<PendingMedia[]>([]);
  const fileRef = useRef<HTMLInputElement>(null);
  const pendingRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!pending.length) return;
    pendingRef.current?.scrollIntoView({ behavior: "auto", block: "center" });
  }, [pending.length]);

  if (!state || !me) return null;
  const event = state.gatherings.find((g) => g.id === id);
  if (!event) {
    return (
      <div className="p-6">
        החברה לא נמצאה. <Link href="/journal" className="underline">חזרה ליומן</Link>
      </div>
    );
  }

  const host = memberById(state.members, event.hostId);
  const lecturer = memberById(state.members, event.lecturerId);
  const currentSummary = summary ?? event.summary ?? "";

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

  return (
    <div className="mx-auto max-w-5xl space-y-8">
      <Link href="/journal" className="inline-flex items-center gap-1 text-sm font-light text-muted-foreground">
        <ArrowRight className="size-4" />
        חזרה ליומן
      </Link>
      <div>
        <p className="text-[13px] font-light text-muted-foreground">{formatDateTimeHe(event.startsAt)}</p>
        <h1 className="mt-1 text-[1.65rem] font-medium tracking-tight md:text-[2rem]">
          {gatheringTitle(event) ?? gatheringLabel(event)}
        </h1>
        <p className="mt-2 text-[15px] font-light text-muted-foreground">
          {event.location} · מארח {host?.displayName}
          {lecturer ? ` · שיעור: ${lecturer.displayName}` : ""}
        </p>
      </div>

      {event.topic ? (
        <p className="paper-card rounded-[1.75rem] px-5 py-4 text-sm font-light">
          נושא: {event.topic}
        </p>
      ) : null}

      <div className="flex flex-wrap items-center justify-between gap-3">
        <h2 className="text-sm font-normal text-muted-foreground">גלריה</h2>
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
            <Button variant="outline" onClick={() => fileRef.current?.click()}>
              <Upload data-icon="inline-start" />
              העלאת תמונה או סרטון
            </Button>
          </>
        ) : null}
      </div>

      {event.media.length === 0 && pending.length === 0 ? (
        <Card className="paper-card rounded-[1.75rem]">
          <CardContent className="py-10 text-center font-light text-muted-foreground">
            עדיין אין מדיה לחברה הזאת. אפשר להעלות תמונות וסרטונים שיוצגו כאן ישירות בדפדפן.
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-4 md:grid-cols-2">
          {event.media.map((item) => (
            <figure
              key={item.id}
              className="overflow-hidden rounded-2xl bg-black/90 ring-1 ring-black/10"
            >
              {item.type === "video" ? (
                <video
                  src={item.url}
                  controls
                  playsInline
                  preload="metadata"
                  className="max-h-[420px] w-full bg-black"
                />
              ) : item.type === "audio" ? (
                <div className="p-4">
                  <audio src={item.url} controls className="w-full" />
                </div>
              ) : (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={item.url} alt={item.caption ?? ""} className="w-full object-cover" />
              )}
              {item.caption ? (
                <figcaption className="bg-white px-3 py-2 text-sm text-muted-foreground">
                  {item.caption} · {memberById(state.members, item.uploadedBy)?.displayName}
                </figcaption>
              ) : null}
            </figure>
          ))}
          {pending.map((item, index) => (
            <figure
              key={item.id}
              ref={index === pending.length - 1 ? pendingRef : undefined}
              className="overflow-hidden rounded-2xl bg-black/90 ring-1 ring-black/10"
            >
              <MediaProgressOverlay
                src={item.previewUrl}
                type={item.type}
                progress={item.progress}
                remainingSeconds={item.remainingSeconds}
                onReady={() =>
                  pendingRef.current?.scrollIntoView({ behavior: "auto", block: "center" })
                }
              />
              <figcaption className="bg-white px-3 py-2 text-sm text-muted-foreground">
                {item.name} · {user.displayName}
              </figcaption>
            </figure>
          ))}
        </div>
      )}

      <Card className="paper-card rounded-[1.75rem]">
        <CardHeader>
          <CardTitle className="font-medium">סיכום השיעור</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          {can(me, "uploadSummary") ? (
            <>
              <Textarea
                rows={5}
                value={currentSummary}
                onChange={(e) => setSummary(e.target.value)}
                placeholder="סיכום קצר, מקורות, נקודות להמשך…"
              />
              <Button
                onClick={async () => {
                  await act({ type: "saveSummary", eventId: event.id, summary: currentSummary });
                  toast.success("הסיכום נשמר");
                }}
              >
                שמירת סיכום
              </Button>
            </>
          ) : currentSummary ? (
            <p className="whitespace-pre-wrap leading-7">{currentSummary}</p>
          ) : (
            <p className="text-muted-foreground">עדיין אין סיכום לחברה זו.</p>
          )}
          {event.audioUrl ? (
            <audio src={event.audioUrl} controls className="w-full" />
          ) : null}
        </CardContent>
      </Card>

      {can(me, "viewRsvps") ? (
        <Card className="paper-card rounded-[1.75rem]">
          <CardHeader>
            <CardTitle className="font-medium">אישורי הגעה</CardTitle>
          </CardHeader>
          <CardContent className="grid gap-2 sm:grid-cols-2">
            {state.members.map((member) => (
              <div key={member.id} className="flex items-center justify-between rounded-xl bg-secondary px-3 py-2">
                <span className="flex items-center gap-2">
                  <UserAvatar member={member} size="sm" />
                  {member.displayName}
                </span>
                <span className="text-xs">{rsvpLabel(event.rsvps[member.id] ?? "pending")}</span>
              </div>
            ))}
          </CardContent>
        </Card>
      ) : null}
    </div>
  );
}
