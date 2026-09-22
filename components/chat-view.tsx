"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  ArrowLeft,
  ArrowRight,
  Hash,
  Megaphone,
  Mic,
  Paperclip,
  Quote,
  Reply,
  Send,
  Smile,
  Trees,
  Utensils,
} from "lucide-react";
import { toast } from "sonner";
import { useApp } from "@/components/app-provider";
import { UserAvatar } from "@/components/user-avatar";
import { Button } from "@/components/ui/button";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { ScrollArea } from "@/components/ui/scroll-area";
import { formatRelativeHe, memberById } from "@/lib/format";
import { can } from "@/lib/permissions";
import { dmName } from "@/lib/selectors";
import type { Channel, Message } from "@/lib/types";
import { cn } from "@/lib/utils";

const EMOJIS = ["❤️", "👍", "😂", "🙏", "🔥", "✨", "🎉", "☕"];

export function ChatView({ channelId }: { channelId?: string }) {
  const { state, me, act } = useApp();
  const router = useRouter();
  const [draft, setDraft] = useState("");
  const [quote, setQuote] = useState<Message["quote"]>();
  const [mentionOpen, setMentionOpen] = useState(false);
  const endRef = useRef<HTMLDivElement>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  const [recording, setRecording] = useState(false);
  const mediaRef = useRef<MediaRecorder | null>(null);

  const channels = useMemo(() => {
    if (!state || !me) return [];
    return state.channels.filter((c) => c.memberIds.includes(me.id));
  }, [state, me]);

  const active = channels.find((c) => c.id === channelId) ?? null;
  const messages = (state?.messages ?? [])
    .filter((m) => m.channelId === active?.id)
    .sort((a, b) => +new Date(a.createdAt) - +new Date(b.createdAt));

  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages.length, active?.id]);

  useEffect(() => {
    if (channelId || channels.length === 0) return;
    if (!window.matchMedia("(min-width: 768px)").matches) return;
    const firstRoom = channels.find((c) => c.type !== "dm") ?? channels[0];
    if (firstRoom) router.replace(`/chat/${firstRoom.id}`);
  }, [channelId, channels, router]);

  if (!state || !me) return null;

  const groups = groupChannels(channels);
  const canWrite =
    active &&
    (active.type !== "announcements" || can(me, "postAnnouncement"));

  async function send(extra?: Partial<Message>) {
    if (!active || !me || !state) return;
    const text = draft.trim();
    if (!text && !extra?.voiceUrl && !extra?.attachments?.length) return;
    const mentions = state.members
      .filter((member) => text.includes(`@${member.displayName}`))
      .map((member) => member.id);
    try {
      await act({
        type: "sendMessage",
        channelId: active.id,
        text,
        quote,
        mentions,
        attachments: extra?.attachments,
        voiceUrl: extra?.voiceUrl,
      });
      setDraft("");
      setQuote(undefined);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "שליחה נכשלה");
    }
  }

  async function attach(files: FileList | null) {
    if (!files?.length || !active) return;
    const attachments = [];
    for (const file of Array.from(files)) {
      const body = new FormData();
      body.append("file", file);
      const res = await fetch("/api/upload", { method: "POST", body });
      const data = await res.json();
      if (!res.ok) continue;
      attachments.push({
        id: crypto.randomUUID(),
        type: file.type.startsWith("video")
          ? ("video" as const)
          : file.type.startsWith("audio")
            ? ("audio" as const)
            : file.type.startsWith("image")
              ? ("image" as const)
              : ("file" as const),
        url: data.url as string,
        name: file.name,
      });
    }
    await send({ attachments });
  }

  async function toggleRecord() {
    if (recording) {
      mediaRef.current?.stop();
      setRecording(false);
      return;
    }
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const rec = new MediaRecorder(stream);
      const chunks: Blob[] = [];
      rec.ondataavailable = (ev) => {
        if (ev.data.size) chunks.push(ev.data);
      };
      rec.onstop = async () => {
        stream.getTracks().forEach((t) => t.stop());
        const blob = new Blob(chunks, { type: rec.mimeType || "audio/webm" });
        const file = new File([blob], `voice-${Date.now()}.webm`, { type: blob.type });
        const body = new FormData();
        body.append("file", file);
        const res = await fetch("/api/upload", { method: "POST", body });
        const data = await res.json();
        if (res.ok) await send({ voiceUrl: data.url });
      };
      mediaRef.current = rec;
      rec.start();
      setRecording(true);
    } catch {
      toast.error("אין גישה למיקרופון");
    }
  }

  const mentionQuery = draft.split("@").pop() ?? "";
  const mentionMatches =
    draft.includes("@") && mentionOpen
      ? state.members.filter((m) => m.displayName.includes(mentionQuery) || mentionQuery.length === 0)
      : [];

  return (
    <div className="flex h-[calc(100dvh-56px)] bg-white pb-16 md:h-full md:bg-transparent md:px-6 md:pt-3 md:pb-5">
      <div className="flex min-h-0 min-w-0 flex-1 overflow-hidden md:h-full md:rounded-[1.75rem] md:bg-[var(--paper-card)] md:ring-1 md:ring-black/5">
      <aside
        className={cn(
          "w-full shrink-0 border-e border-black/5 bg-white/90 md:w-80 md:bg-transparent",
          active ? "hidden md:flex md:flex-col" : "flex flex-col"
        )}
      >
        <div className="border-b border-black/5 px-4 py-4">
          <h1 className="text-xl font-medium tracking-tight">צ׳אט החבורה</h1>
          <p className="text-xs font-light text-muted-foreground">ערוצים, הודעות ושיחות אישיות</p>
        </div>
        <ScrollArea className="flex-1">
          <RoomGroup title="ערוצים">
            {groups.rooms.map((channel) => (
              <RoomRow
                key={channel.id}
                channel={channel}
                active={channel.id === active?.id}
                meId={me.id}
                members={state.members}
                last={lastMessage(state.messages, channel.id)}
              />
            ))}
          </RoomGroup>
          <RoomGroup title="שיחות אישיות">
            {groups.dms.map((channel) => (
              <RoomRow
                key={channel.id}
                channel={channel}
                active={channel.id === active?.id}
                meId={me.id}
                members={state.members}
                last={lastMessage(state.messages, channel.id)}
              />
            ))}
          </RoomGroup>
          <div className="p-3">
            <p className="mb-2 px-1 text-[11px] text-muted-foreground">פתח שיחה עם</p>
            <div className="flex flex-wrap gap-1">
              {state.members
                .filter((member) => member.id !== me.id)
                .map((member) => (
                  <button
                    key={member.id}
                    className="rounded-full bg-[#f7f1e8] px-2 py-1 text-[11px]"
                    onClick={async () => {
                      const next = await act({ type: "createDm", memberId: member.id });
                      const dm = next.channels.find(
                        (c) =>
                          c.type === "dm" &&
                          c.memberIds.includes(me.id) &&
                          c.memberIds.includes(member.id)
                      );
                      if (dm) router.push(`/chat/${dm.id}`);
                    }}
                  >
                    {member.displayName.split(" ")[0]}
                  </button>
                ))}
            </div>
          </div>
        </ScrollArea>
      </aside>

      <section
        className={cn(
          "min-w-0 flex-1 flex-col bg-[#f7f4ee] md:bg-[#faf8f4]/70",
          active ? "flex" : "hidden md:flex"
        )}
      >
        {active ? (
          <>
            <header className="flex items-center gap-3 border-b border-black/5 bg-white/90 px-3 py-2.5 md:bg-white/50">
              <Link href="/chat" className="md:hidden" aria-label="חזרה">
                <ArrowRight className="size-5" />
              </Link>
              <RoomIcon channel={active} />
              <div className="min-w-0">
                <div className="truncate font-medium">
                  {active.type === "dm"
                    ? dmName(active.name, active.memberIds, me.id, (id) => memberById(state.members, id)?.displayName ?? "")
                    : active.name}
                </div>
                <div className="text-[11px] text-muted-foreground">
                  {active.memberIds.length} חברים
                  {active.description ? ` · ${active.description}` : ""}
                </div>
              </div>
              <div className="ms-2 hidden -space-x-2 space-x-reverse sm:flex">
                {active.memberIds.slice(0, 5).map((id) => (
                  <UserAvatar key={id} member={memberById(state.members, id)} size="sm" />
                ))}
              </div>
            </header>

            <div className="flex-1 space-y-4 overflow-y-auto px-3 py-4 pb-36 md:px-6 md:pb-4">
              {messages.map((message) => {
                const author = memberById(state.members, message.authorId);
                const mine = message.authorId === me.id;
                const quoted = message.quote
                  ? memberById(state.members, message.quote.authorId)
                  : null;
                return (
                  <article key={message.id} className="flex gap-2">
                    <UserAvatar member={author} size="sm" />
                    <div className="min-w-0 max-w-[min(100%,42rem)]">
                      <div className="mb-0.5 flex items-baseline gap-2">
                        <span className="text-sm font-medium">{author?.displayName}</span>
                        <span className="text-[11px] text-muted-foreground">
                          {formatRelativeHe(message.createdAt)}
                        </span>
                      </div>
                      <div
                        className={cn(
                          "rounded-2xl rounded-ss-md px-3 py-2 text-sm leading-6 shadow-sm",
                          mine ? "bg-[#e7f3f1] text-foreground" : "bg-white"
                        )}
                      >
                        {message.quote ? (
                          <div className="mb-2 flex gap-2 rounded-xl bg-black/5 px-2 py-1.5">
                            <Quote className="mt-0.5 size-3.5 text-primary" />
                            <div className="min-w-0">
                              <div className="text-[11px] font-medium text-primary">
                                {quoted?.displayName}
                              </div>
                              <div className="truncate text-xs text-muted-foreground">
                                {message.quote.text}
                              </div>
                            </div>
                          </div>
                        ) : null}
                        {message.text ? <p className="whitespace-pre-wrap">{highlightMentions(message.text)}</p> : null}
                        {message.voiceUrl ? (
                          <audio src={message.voiceUrl} controls className="mt-2 w-full" />
                        ) : null}
                        {message.attachments.map((file) =>
                          file.type === "image" ? (
                            // eslint-disable-next-line @next/next/no-img-element
                            <img
                              key={file.id}
                              src={file.url}
                              alt={file.name}
                              className="mt-2 max-h-64 rounded-xl object-cover"
                            />
                          ) : file.type === "video" ? (
                            <video
                              key={file.id}
                              src={file.url}
                              controls
                              playsInline
                              className="mt-2 max-h-64 w-full rounded-xl bg-black"
                            />
                          ) : (
                            <a
                              key={file.id}
                              href={file.url}
                              className="mt-2 inline-block text-xs underline"
                            >
                              {file.name}
                            </a>
                          )
                        )}
                      </div>
                      <div className="mt-1 flex flex-wrap items-center gap-1">
                        {Object.entries(message.reactions).map(([emoji, ids]) => (
                          <button
                            key={emoji}
                            onClick={() => void act({ type: "react", messageId: message.id, emoji })}
                            className={cn(
                              "rounded-full px-1.5 py-0.5 text-xs ring-1 ring-black/5",
                              ids.includes(me.id) ? "bg-primary/10" : "bg-white"
                            )}
                          >
                            {emoji} {ids.length}
                          </button>
                        ))}
                        <Popover>
                          <PopoverTrigger asChild>
                            <Button variant="ghost" size="xs" aria-label="תגובה">
                              <Smile data-icon="inline-start" />
                              הגב
                            </Button>
                          </PopoverTrigger>
                          <PopoverContent className="flex w-auto gap-1 p-2" align="start">
                            {EMOJIS.map((emoji) => (
                              <button
                                key={emoji}
                                className="size-8 rounded-lg text-lg hover:bg-muted"
                                onClick={() => void act({ type: "react", messageId: message.id, emoji })}
                              >
                                {emoji}
                              </button>
                            ))}
                          </PopoverContent>
                        </Popover>
                        <Button
                          variant="ghost"
                          size="xs"
                          aria-label="השב"
                          onClick={() =>
                            setQuote({
                              messageId: message.id,
                              authorId: message.authorId,
                              text: message.text.slice(0, 140),
                            })
                          }
                        >
                          <Reply data-icon="inline-start" />
                          השב
                        </Button>
                      </div>
                    </div>
                  </article>
                );
              })}
              <div ref={endRef} />
            </div>

            <div className="fixed inset-x-0 bottom-[58px] z-20 border-t border-black/5 bg-white/95 p-2 pb-[max(0.5rem,env(safe-area-inset-bottom))] md:static md:bottom-auto md:bg-white/50 md:pb-3">
              {quote ? (
                <div className="mb-2 flex items-center justify-between rounded-xl bg-[#f7f1e8] px-3 py-2 text-xs">
                  <span>
                    ציטוט של {memberById(state.members, quote.authorId)?.displayName}: {quote.text}
                  </span>
                  <button onClick={() => setQuote(undefined)}>×</button>
                </div>
              ) : null}
              {canWrite ? (
                <form
                  className="flex items-end gap-1.5"
                  onSubmit={(e) => {
                    e.preventDefault();
                    void send();
                  }}
                >
                  <input
                    ref={fileRef}
                    type="file"
                    className="hidden"
                    multiple
                    onChange={(e) => void attach(e.target.files)}
                  />
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    aria-label="צירוף"
                    onClick={() => fileRef.current?.click()}
                  >
                    <Paperclip />
                  </Button>
                  <div className="relative min-w-0 flex-1">
                    {mentionMatches.length > 0 ? (
                      <div className="absolute inset-x-0 bottom-full mb-1 overflow-hidden rounded-xl bg-white shadow-lg ring-1 ring-black/5">
                        {mentionMatches.slice(0, 5).map((member) => (
                          <button
                            type="button"
                            key={member.id}
                            className="flex w-full items-center gap-2 px-3 py-2 text-start text-sm hover:bg-muted"
                            onClick={() => {
                              const base = draft.slice(0, draft.lastIndexOf("@"));
                              setDraft(`${base}@${member.displayName} `);
                              setMentionOpen(false);
                            }}
                          >
                            <UserAvatar member={member} size="sm" />
                            {member.displayName}
                          </button>
                        ))}
                      </div>
                    ) : null}
                    <textarea
                      value={draft}
                      rows={1}
                      placeholder={
                        active.type === "announcements"
                          ? "עדכון לחבורה…"
                          : "כתבו הודעה. @ לתייג חבר"
                      }
                      className="max-h-28 w-full resize-none rounded-2xl border border-input bg-white px-3 py-2 text-sm outline-none focus-visible:ring-2 focus-visible:ring-ring/40"
                      onChange={(e) => {
                        setDraft(e.target.value);
                        setMentionOpen(e.target.value.includes("@"));
                      }}
                      onKeyDown={(e) => {
                        if (e.key === "Enter" && !e.shiftKey) {
                          e.preventDefault();
                          void send();
                        }
                      }}
                    />
                  </div>
                  <Popover>
                    <PopoverTrigger asChild>
                      <Button type="button" variant="ghost" size="icon" aria-label="אימוג׳י">
                        <Smile />
                      </Button>
                    </PopoverTrigger>
                    <PopoverContent className="grid w-56 grid-cols-8 gap-1 p-2">
                      {["😀", "😂", "🙏", "❤️", "🔥", "✨", "👍", "🎉", "☕", "🍰", "📚", "🏡", "🚗", "🌙", "⭐", "💪"].map(
                        (emoji) => (
                          <button
                            type="button"
                            key={emoji}
                            className="size-7 rounded hover:bg-muted"
                            onClick={() => setDraft((d) => d + emoji)}
                          >
                            {emoji}
                          </button>
                        )
                      )}
                    </PopoverContent>
                  </Popover>
                  <Button
                    type="button"
                    variant={recording ? "destructive" : "ghost"}
                    size="icon"
                    aria-label="הודעה קולית"
                    onClick={() => void toggleRecord()}
                  >
                    <Mic />
                  </Button>
                  <Button type="submit" size="icon" aria-label="שליחה">
                    <Send />
                  </Button>
                </form>
              ) : (
                <p className="px-3 py-2 text-center text-sm text-muted-foreground">
                  רק מנהל המערכת ומגיד השיעור יכולים לכתוב בערוץ ההודעות הרשמיות.
                </p>
              )}
            </div>
          </>
        ) : (
          <div className="hidden flex-1 items-center justify-center text-muted-foreground md:flex">
            בחרו שיחה מהרשימה
          </div>
        )}
      </section>
      </div>
    </div>
  );
}

function RoomGroup({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="px-2 py-3">
      <div className="px-2 pb-1 text-[11px] font-medium tracking-wide text-muted-foreground">
        {title}
      </div>
      <div className="space-y-0.5">{children}</div>
    </div>
  );
}

function RoomRow({
  channel,
  active,
  meId,
  members,
  last,
}: {
  channel: Channel;
  active: boolean;
  meId: string;
  members: { id: string; displayName: string; initials: string; avatarColor: string }[];
  last?: Message;
}) {
  const label =
    channel.type === "dm"
      ? dmName(channel.name, channel.memberIds, meId, (id) => members.find((m) => m.id === id)?.displayName ?? "")
      : channel.name;
  return (
    <Link
      href={`/chat/${channel.id}`}
      className={cn(
        "flex items-center gap-2 rounded-xl px-2 py-2 text-sm",
        active ? "bg-primary/10 text-primary" : "hover:bg-black/5"
      )}
    >
      <RoomIcon channel={channel} />
      <div className="min-w-0 flex-1">
        <div className="truncate font-medium">{label}</div>
        <div className="truncate text-[11px] text-muted-foreground">{last?.text || "אין הודעות עדיין"}</div>
      </div>
    </Link>
  );
}

function RoomIcon({ channel }: { channel: Channel }) {
  const cls = "size-8 rounded-lg bg-[#f7f1e8] text-primary flex items-center justify-center";
  if (channel.type === "announcements")
    return (
      <span className={cls}>
        <Megaphone className="size-4" />
      </span>
    );
  if (channel.name.includes("כיבוד"))
    return (
      <span className={cls}>
        <Utensils className="size-4" />
      </span>
    );
  if (channel.name.includes("טיול"))
    return (
      <span className={cls}>
        <Trees className="size-4" />
      </span>
    );
  if (channel.type === "dm")
    return (
      <span className={cls}>
        <ArrowLeft className="size-4" />
      </span>
    );
  return (
    <span className={cls}>
      <Hash className="size-4" />
    </span>
  );
}

function lastMessage(messages: Message[], channelId: string) {
  return messages
    .filter((m) => m.channelId === channelId)
    .sort((a, b) => +new Date(b.createdAt) - +new Date(a.createdAt))[0];
}

function groupChannels(channels: Channel[]) {
  return {
    rooms: channels.filter((c) => c.type !== "dm"),
    dms: channels.filter((c) => c.type === "dm"),
  };
}

function highlightMentions(text: string) {
  const parts = text.split(/(@[^\s]+(?:\s[^\s]+)?)/g);
  return parts.map((part, i) =>
    part.startsWith("@") ? (
      <span key={i} className="rounded bg-primary/10 px-1 text-primary">
        {part}
      </span>
    ) : (
      <span key={i}>{part}</span>
    )
  );
}
