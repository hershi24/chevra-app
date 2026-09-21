"use client";

import { use, useRef, useState } from "react";
import Link from "next/link";
import { ArrowRight, Upload } from "lucide-react";
import { toast } from "sonner";
import { useApp } from "@/components/app-provider";
import { UserAvatar } from "@/components/user-avatar";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Textarea } from "@/components/ui/textarea";
import {
  formatDateTimeHe,
  memberById,
  rsvpLabel,
} from "@/lib/format";
import { can } from "@/lib/permissions";
import type { EventMedia } from "@/lib/types";

export function JournalDetail({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = use(params);
  const { state, me, act } = useApp();
  const [summary, setSummary] = useState<string | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  if (!state || !me) return null;
  const event = state.gatherings.find((g) => g.id === id);
  if (!event) {
    return (
      <div className="p-6">
        המפגש לא נמצא. <Link href="/journal" className="underline">חזרה ליומן</Link>
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
    for (const file of Array.from(files)) {
      const body = new FormData();
      body.append("file", file);
      const res = await fetch("/api/upload", { method: "POST", body });
      const data = await res.json();
      if (!res.ok) {
        toast.error(data.error || "העלאה נכשלה");
        continue;
      }
      const type: EventMedia["type"] = file.type.startsWith("video")
        ? "video"
        : file.type.startsWith("audio")
          ? "audio"
          : "image";
      await act({
        type: "uploadMedia",
        eventId: gathering.id,
        media: {
          id: crypto.randomUUID(),
          type,
          url: data.url,
          caption: file.name,
          uploadedBy: user.id,
          createdAt: new Date().toISOString(),
        },
      });
    }
    toast.success("המדיה נוספה ליומן");
  }

  return (
    <div className="mx-auto max-w-5xl space-y-8">
      <Link href="/journal" className="inline-flex items-center gap-1 text-sm font-light text-muted-foreground">
        <ArrowRight className="size-4" />
        חזרה ליומן
      </Link>
      <div>
        <p className="text-[13px] font-light text-muted-foreground">{formatDateTimeHe(event.startsAt)}</p>
        <h1 className="mt-1 text-[1.65rem] font-medium tracking-tight md:text-[2rem]">{event.title}</h1>
        <p className="mt-2 text-[15px] font-light text-muted-foreground">
          {event.location} · מארח {host?.displayName}
          {lecturer ? ` · שיעור: ${lecturer.displayName}` : ""}
        </p>
      </div>

      {event.topic ? (
        <p className="rounded-[1.75rem] bg-white/55 px-5 py-4 text-sm font-light backdrop-blur-md">
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

      {event.media.length === 0 ? (
        <Card className="rounded-[1.75rem] bg-white/55">
          <CardContent className="py-10 text-center font-light text-muted-foreground">
            עדיין אין מדיה למפגש הזה. אפשר להעלות תמונות וסרטונים שיוצגו כאן ישירות בדפדפן.
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
        </div>
      )}

      <Card className="rounded-[1.75rem] bg-white/55">
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
            <p className="text-muted-foreground">עדיין אין סיכום למפגש זה.</p>
          )}
          {event.audioUrl ? (
            <audio src={event.audioUrl} controls className="w-full" />
          ) : null}
        </CardContent>
      </Card>

      {can(me, "viewRsvps") ? (
        <Card className="rounded-[1.75rem] bg-white/55">
          <CardHeader>
            <CardTitle className="font-medium">אישורי הגעה</CardTitle>
          </CardHeader>
          <CardContent className="grid gap-2 sm:grid-cols-2">
            {state.members.map((member) => (
              <div key={member.id} className="flex items-center justify-between rounded-xl bg-[#f7f1e8] px-3 py-2">
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
