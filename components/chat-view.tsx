"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  ArrowLeft,
  ArrowRight,
  BookOpen,
  Hash,
  Megaphone,
  Mic,
  Paperclip,
  Quote,
  Reply,
  Send,
  Smile,
  Trash2,
  Trees,
  Utensils,
} from "lucide-react";
import { toast } from "sonner";
import { useApp } from "@/components/app-provider";
import { ChatBubble } from "@/components/chat-bubble";
import { MediaProgressOverlay } from "@/components/media-progress";
import { UserAvatar } from "@/components/user-avatar";
import { VoiceNotePlayer } from "@/components/voice-note-player";
import { Button } from "@/components/ui/button";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import {
  guideChatTitle,
  isGuideChannel,
  isRoshChevra,
} from "@/lib/channels";
import { formatRelativeHe, memberById } from "@/lib/format";
import { can, canDeleteMessage } from "@/lib/permissions";
import { dmName } from "@/lib/selectors";
import type { Attachment, Channel, Member, Message } from "@/lib/types";
import {
  microphoneErrorMessage,
  pickRecorderMime,
  requestMicrophone,
} from "@/lib/microphone";
import { createLocalUpload, preloadMedia, uploadWithProgress } from "@/lib/upload-client";
import { cn } from "@/lib/utils";

type PendingChatUpload = {
  id: string;
  previewUrl: string;
  type: "image" | "video" | "audio" | "file";
  progress: number;
  remainingSeconds: number | null;
  name: string;
};

const EMOJIS = ["❤️", "👍", "😂", "🙏", "🔥", "✨", "🎉", "☕"];

export function ChatView({ channelId }: { channelId?: string }) {
  const { state, me, act, onlineIds } = useApp();
  const router = useRouter();
  const [draft, setDraft] = useState("");
  const [quote, setQuote] = useState<Message["quote"]>();
  const [mentionOpen, setMentionOpen] = useState(false);
  const endRef = useRef<HTMLDivElement>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  const composerRef = useRef<HTMLTextAreaElement>(null);
  const [recording, setRecording] = useState(false);
  const [pendingUploads, setPendingUploads] = useState<PendingChatUpload[]>([]);
  const [deleteTarget, setDeleteTarget] = useState<Message | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [flashId, setFlashId] = useState<string | null>(null);
  const [hoveredMessageId, setHoveredMessageId] = useState<string | null>(null);
  const flashTimer = useRef<number | null>(null);
  const mediaRef = useRef<MediaRecorder | null>(null);
  const pendingChatRef = useRef<HTMLElement>(null);

  const channels = useMemo(() => {
    if (!state || !me) return [];
    return state.channels.filter((c) => c.memberIds.includes(me.id));
  }, [state, me]);

  const active = channels.find((c) => c.id === channelId) ?? null;
  const messages = (state?.messages ?? [])
    .filter((m) => m.channelId === active?.id)
    .sort((a, b) => +new Date(a.createdAt) - +new Date(b.createdAt));

  function scrollPendingIntoView() {
    pendingChatRef.current?.scrollIntoView({ behavior: "auto", block: "center" });
  }

  useEffect(() => {
    if (pendingUploads.length) {
      scrollPendingIntoView();
      return;
    }
    endRef.current?.scrollIntoView({ behavior: "smooth", block: "end" });
  }, [messages.length, active?.id, pendingUploads.length]);

  useEffect(() => {
    const el = composerRef.current;
    if (!el) return;
    const min = window.matchMedia("(min-width: 768px)").matches ? 40 : 36;
    el.style.height = `${min}px`;
    if (draft) el.style.height = `${Math.min(Math.max(el.scrollHeight, min), 112)}px`;
  }, [draft]);

  useEffect(() => {
    if (channelId || channels.length === 0) return;
    if (!window.matchMedia("(min-width: 768px)").matches) return;
    const firstRoom = channels.find((c) => c.type !== "dm") ?? channels[0];
    if (firstRoom) router.replace(`/chat/${firstRoom.id}`);
  }, [channelId, channels, router]);

  if (!state || !me) return null;

  const groups = groupChannels(channels, state.members);
  const guideActive = Boolean(active && isGuideChannel(active, state.members));
  const canWrite =
    active &&
    (active.type !== "announcements" || can(me, "postAnnouncement"));

  function jumpToMessage(messageId: string) {
    const el = document.getElementById(`message-${messageId}`);
    if (!el) {
      toast.message("ההודעה המקורית לא נמצאת בשיחה");
      return;
    }
    el.scrollIntoView({ behavior: "smooth", block: "center" });
    setFlashId(messageId);
    if (flashTimer.current) window.clearTimeout(flashTimer.current);
    flashTimer.current = window.setTimeout(() => setFlashId(null), 1600);
  }

  async function openPersonalChat(member: Member) {
    if (!me) return;
    const myId = me.id;
    const existing = channels.find(
      (channel) =>
        channel.type === "dm" &&
        channel.memberIds.includes(myId) &&
        channel.memberIds.includes(member.id) &&
        channel.memberIds.length === 2
    );
    if (existing) {
      router.push(`/chat/${existing.id}`);
      return;
    }
    try {
      const next = await act({ type: "createDm", memberId: member.id });
      const dm = next.channels.find(
        (channel) =>
          channel.type === "dm" &&
          channel.memberIds.includes(myId) &&
          channel.memberIds.includes(member.id)
      );
      if (dm) router.push(`/chat/${dm.id}`);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "לא הצלחנו לפתוח שיחה");
    }
  }

  async function send(extra?: Partial<Message>) {
    if (!active || !me || !state) return;
    const text = draft.trim();
    if (!text && !extra?.voiceUrl && !extra?.attachments?.length) return;
    const mentions = state.members
      .filter((member) => text.includes(`@${member.displayName}`))
      .map((member) => member.id);
    const quoted = quote;
    setDraft("");
    setQuote(undefined);
    try {
      await act({
        type: "sendMessage",
        id: crypto.randomUUID(),
        channelId: active.id,
        text,
        quote: quoted,
        mentions,
        attachments: extra?.attachments,
        voiceUrl: extra?.voiceUrl,
      });
    } catch (error) {
      setDraft(text);
      setQuote(quoted);
      toast.error(error instanceof Error ? error.message : "שליחה נכשלה");
    }
  }

  async function deleteMessageById(messageId: string) {
    await act({ type: "deleteMessage", messageId });
    toast.success("ההודעה נמחקה");
  }

  async function confirmDelete() {
    if (!deleteTarget) return;
    setDeleting(true);
    try {
      await deleteMessageById(deleteTarget.id);
      setDeleteTarget(null);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "המחיקה נכשלה");
    } finally {
      setDeleting(false);
    }
  }

  async function deleteFromHover(message: Message) {
    try {
      await deleteMessageById(message.id);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "המחיקה נכשלה");
    }
  }

  async function attach(files: FileList | null) {
    if (!files?.length || !active) return;
    const items = Array.from(files).map((file) => createLocalUpload(file));
    setPendingUploads((prev) => [
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

    const attachments: Attachment[] = [];
    await Promise.all(
      items.map(async (item) => {
        try {
          const data = await uploadWithProgress(item.file, {}, ({ percent, remainingSeconds }) => {
            setPendingUploads((prev) =>
              prev.map((p) =>
                p.id === item.id ? { ...p, progress: percent, remainingSeconds } : p
              )
            );
          });
          await preloadMedia(data.url, item.type);
          attachments.push({
            id: crypto.randomUUID(),
            type: item.type,
            url: data.url,
            name: item.name,
          });
        } catch (error) {
          toast.error(error instanceof Error ? error.message : "העלאה נכשלה");
        }
      })
    );

    if (attachments.length) await send({ attachments });
    items.forEach((item) => URL.revokeObjectURL(item.previewUrl));
    setPendingUploads((prev) => prev.filter((p) => !items.some((item) => item.id === p.id)));
  }

  async function toggleRecord() {
    if (recording) {
      mediaRef.current?.stop();
      setRecording(false);
      return;
    }
    try {
      toast.message("אשר גישה למיקרופון בשורת הכתובת למעלה");
      const stream = await requestMicrophone();
      const mime = pickRecorderMime();
      if (typeof MediaRecorder === "undefined") {
        stream.getTracks().forEach((track) => track.stop());
        toast.error("הדפדפן במחשב לא תומך בהקלטה. נסו כרום או אדג׳.");
        return;
      }
      const rec = mime ? new MediaRecorder(stream, { mimeType: mime }) : new MediaRecorder(stream);
      const chunks: Blob[] = [];
      rec.ondataavailable = (ev) => {
        if (ev.data.size) chunks.push(ev.data);
      };
      rec.onstop = async () => {
        stream.getTracks().forEach((t) => t.stop());
        const blob = new Blob(chunks, { type: rec.mimeType || "audio/webm" });
        const file = new File([blob], `voice-${Date.now()}.webm`, { type: blob.type || "audio/webm" });
        const local = createLocalUpload(file);
        setPendingUploads((prev) => [
          ...prev,
          {
            id: local.id,
            previewUrl: local.previewUrl,
            type: "audio",
            progress: 0,
            remainingSeconds: null,
            name: local.name,
          },
        ]);
        try {
          const data = await uploadWithProgress(file, {}, ({ percent, remainingSeconds }) => {
            setPendingUploads((prev) =>
              prev.map((p) =>
                p.id === local.id ? { ...p, progress: percent, remainingSeconds } : p
              )
            );
          });
          await preloadMedia(data.url, "audio");
          await send({ voiceUrl: data.url });
        } catch {
          toast.error("העלאה נכשלה");
        } finally {
          URL.revokeObjectURL(local.previewUrl);
          setPendingUploads((prev) => prev.filter((p) => p.id !== local.id));
        }
      };
      mediaRef.current = rec;
      rec.start();
      setRecording(true);
    } catch (error) {
      toast.error(microphoneErrorMessage(error));
    }
  }

  const mentionQuery = draft.split("@").pop() ?? "";
  const mentionMatches =
    draft.includes("@") && mentionOpen
      ? state.members.filter((m) => m.displayName.includes(mentionQuery) || mentionQuery.length === 0)
      : [];

  return (
    <>
    <div
      className="flex h-[calc(100dvh-4rem-env(safe-area-inset-bottom))] bg-white md:h-full md:bg-transparent md:px-6 md:pt-3 md:pb-5"
    >
      <div className="flex min-h-0 min-w-0 flex-1 overflow-hidden md:h-full md:rounded-[1.75rem] md:bg-[var(--paper-card)] md:ring-1 md:ring-black/5">
      <aside
        className={cn(
          "w-full min-h-0 shrink-0 border-e border-black/5 bg-white/90 md:w-80 md:bg-transparent",
          active ? "hidden md:flex md:flex-col" : "flex min-h-0 flex-col"
        )}
      >
        <div className="border-b border-black/5 px-4 py-4">
          <h1 className="text-xl font-medium tracking-tight">צ׳אט החבורה</h1>
          <p className="text-xs font-light text-muted-foreground">
            {onlineLabel(onlineIds.length)}
          </p>
        </div>
        <div className="border-b border-black/5 px-4 py-3 md:hidden">
          <p className="mb-2 text-[11px] font-medium tracking-wide text-muted-foreground">
            פתח שיחה אישית
          </p>
          <div className="flex gap-3 overflow-x-auto pb-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
            {state.members
              .filter((member) => member.id !== me.id)
              .map((member) => (
                <button
                  key={member.id}
                  type="button"
                  className="flex w-14 shrink-0 flex-col items-center gap-1"
                  onClick={() => void openPersonalChat(member)}
                >
                  <UserAvatar member={member} size="sm" />
                  <span className="w-full truncate text-center text-[11px] leading-4">
                    {member.displayName.split(" ")[0]}
                  </span>
                </button>
              ))}
          </div>
        </div>
        <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain">
          <RoomGroup title="ערוצים">
            {groups.rooms.map((channel) => (
              <RoomRow
                key={channel.id}
                channel={channel}
                active={channel.id === active?.id}
                me={me}
                members={state.members}
                last={lastMessage(state.messages, channel.id)}
              />
            ))}
          </RoomGroup>
          {groups.guides.length ? (
            <RoomGroup title={isRoshChevra(me) ? "שיחות עם חברים" : "ראש החברה"}>
              {groups.guides.map((channel) => (
                <RoomRow
                  key={channel.id}
                  channel={channel}
                  active={channel.id === active?.id}
                  me={me}
                  members={state.members}
                  last={lastMessage(state.messages, channel.id)}
                />
              ))}
            </RoomGroup>
          ) : null}
          {groups.dms.length ? (
            <RoomGroup title="שיחות אישיות">
              {groups.dms.map((channel) => (
                <RoomRow
                  key={channel.id}
                  channel={channel}
                  active={channel.id === active?.id}
                  me={me}
                  members={state.members}
                  last={lastMessage(state.messages, channel.id)}
                />
              ))}
            </RoomGroup>
          ) : null}
          <div className="hidden md:block">
            <RoomGroup title="פתח שיחה אישית">
              {state.members
                .filter((member) => member.id !== me.id)
                .map((member) => (
                  <button
                    key={member.id}
                    type="button"
                    className="flex w-full items-center gap-2 rounded-xl px-2 py-2 text-start text-sm hover:bg-black/5"
                    onClick={() => void openPersonalChat(member)}
                  >
                    <UserAvatar member={member} size="sm" />
                    <div className="min-w-0 flex-1">
                      <div className="truncate font-medium">{member.displayName}</div>
                      <div className="truncate text-[11px] text-muted-foreground">
                        {isRoshChevra(member) ? "ראש החברה" : "שיחה אישית"}
                      </div>
                    </div>
                  </button>
                ))}
            </RoomGroup>
          </div>
        </div>
      </aside>

      <section
        className={cn(
          "min-w-0 flex-1 flex-col",
          guideActive ? "bg-[#f4f2ee] md:bg-[#f4f2ee]" : "bg-muted md:bg-muted/80",
          active ? "flex" : "hidden md:flex"
        )}
      >
        {active ? (
          <>
            <header
              className={cn(
                "flex shrink-0 items-center gap-3 border-b px-3 py-3",
                guideActive
                  ? "border-[#ded8ce] bg-[#f7f5f1]"
                  : "border-black/5 bg-white md:bg-white/70"
              )}
            >
              <Link href="/chat" className="md:hidden" aria-label="חזרה">
                <ArrowRight className="size-5" />
              </Link>
              <RoomIcon channel={active} members={state.members} />
              <div className="min-w-0">
                <div className="truncate font-medium">
                  {guideActive
                    ? guideChatTitle(active, me, state.members)
                    : active.type === "dm"
                      ? dmName(active.name, active.memberIds, me.id, (id) => memberById(state.members, id)?.displayName ?? "")
                      : active.name}
                </div>
                <div className="text-[11px] text-muted-foreground">
                  {onlineLabel(
                    active.memberIds.filter((id) => onlineIds.includes(id)).length
                  )}
                </div>
              </div>
            </header>

            <div
              className={cn(
                "min-h-0 flex-1 space-y-4 overflow-y-auto px-3 py-4 md:px-6",
                pendingUploads.length && "pb-28"
              )}
            >
              {messages.map((message) => {
                const author = memberById(state.members, message.authorId);
                const mine = message.authorId === me.id;
                const quoted = message.quote
                  ? memberById(state.members, message.quote.authorId)
                  : null;
                return (
                  <article
                    key={message.id}
                    id={`message-${message.id}`}
                    className={cn(
                      "group flex scroll-my-4 gap-2 rounded-2xl transition-colors",
                      flashId === message.id && "bg-[#ece8e0]"
                    )}
                    onMouseEnter={() => setHoveredMessageId(message.id)}
                    onMouseLeave={() =>
                      setHoveredMessageId((current) => (current === message.id ? null : current))
                    }
                  >
                    <UserAvatar member={author} size="sm" />
                    <div className="min-w-0 max-w-[min(100%,42rem)]">
                      <div className="mb-0.5 flex items-baseline gap-2">
                        <span className="text-sm font-medium">{author?.displayName}</span>
                        <span className="text-[11px] text-muted-foreground">
                          {formatRelativeHe(message.createdAt)}
                        </span>
                      </div>
                      <ChatBubble
                        canDelete={canDeleteMessage(me, message)}
                        onLongPress={() => setDeleteTarget(message)}
                        onShortClick={
                          message.quote
                            ? () => jumpToMessage(message.quote!.messageId)
                            : undefined
                        }
                        className={cn(
                          "rounded-2xl rounded-ss-md px-3 py-2 text-sm leading-6 shadow-sm",
                          mine ? "bg-accent text-foreground" : "bg-white"
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
                          <VoiceNotePlayer src={message.voiceUrl} className="mt-2" />
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
                          ) : file.type === "audio" ? (
                            <VoiceNotePlayer key={file.id} src={file.url} className="mt-2" />
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
                      </ChatBubble>
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
                        {canDeleteMessage(me, message) ? (
                          <Button
                            type="button"
                            variant="ghost"
                            size="xs"
                            aria-label="מחק"
                            data-delete-msg=""
                            className={cn(
                              "text-destructive hover:bg-destructive/10 hover:text-destructive",
                              hoveredMessageId === message.id ? "hidden md:inline-flex" : "hidden"
                            )}
                            onClick={() => void deleteFromHover(message)}
                          >
                            <Trash2 data-icon="inline-start" />
                            מחק
                          </Button>
                        ) : null}
                      </div>
                    </div>
                  </article>
                );
              })}
              {pendingUploads.map((item, index) => (
                <article
                  key={item.id}
                  ref={index === pendingUploads.length - 1 ? pendingChatRef : undefined}
                  className="flex gap-2"
                >
                  <UserAvatar member={me} size="sm" />
                  <div className="min-w-0 max-w-[min(100%,42rem)]">
                    <div className="mb-0.5 flex items-baseline gap-2">
                      <span className="text-sm font-medium">{me.displayName}</span>
                      <span className="text-[11px] text-muted-foreground">מעלה…</span>
                    </div>
                    <div className="overflow-hidden rounded-2xl rounded-ss-md bg-accent shadow-sm">
                      <MediaProgressOverlay
                        src={item.previewUrl}
                        type={item.type}
                        progress={item.progress}
                        remainingSeconds={item.remainingSeconds}
                        name={item.name}
                        mediaClassName="max-h-64"
                        onReady={scrollPendingIntoView}
                      />
                    </div>
                  </div>
                </article>
              ))}
              <div ref={endRef} />
            </div>

            <div className="shrink-0 border-t border-black/5 bg-white px-1.5 py-1.5 md:bg-white/70 md:p-3">
              {quote ? (
                <div className="mb-2 flex items-center justify-between rounded-xl bg-secondary px-3 py-2 text-xs">
                  <span>
                    ציטוט של {memberById(state.members, quote.authorId)?.displayName}: {quote.text}
                  </span>
                  <button onClick={() => setQuote(undefined)}>×</button>
                </div>
              ) : null}
              {canWrite ? (
                <form
                  className="flex items-center gap-0.5 md:gap-1"
                  onSubmit={(e) => {
                    e.preventDefault();
                    void send();
                  }}
                >
                  <input
                    ref={fileRef}
                    type="file"
                    accept="image/*,video/*,audio/*"
                    className="hidden"
                    multiple
                    onChange={(e) => void attach(e.target.files)}
                  />
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    aria-label="צירוף"
                    className="size-9 rounded-full md:size-10"
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
                      ref={composerRef}
                      value={draft}
                      rows={1}
                      placeholder={
                        active.type === "announcements"
                          ? "עדכון לחבורה…"
                          : guideActive
                            ? isRoshChevra(me)
                              ? "כתבו לחבר…"
                              : "כתבו לראש החברה…"
                            : "כתבו הודעה…"
                      }
                      className="h-9 max-h-28 min-h-9 w-full resize-none overflow-hidden rounded-full border border-input bg-white px-3 py-1.5 text-sm leading-5 outline-none [scrollbar-width:none] focus-visible:ring-2 focus-visible:ring-ring/40 md:h-10 md:min-h-10 md:px-4 md:py-2 md:leading-6 [&::-webkit-scrollbar]:hidden"
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
                      <Button type="button" variant="ghost" size="icon" className="size-9 rounded-full md:size-10" aria-label="אימוג׳י">
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
                    className="size-9 rounded-full md:size-10"
                    aria-label="הודעה קולית"
                    onClick={() => void toggleRecord()}
                  >
                    <Mic />
                  </Button>
                  <Button type="submit" size="icon" className="size-9 rounded-full md:size-10" aria-label="שליחה">
                    <Send />
                  </Button>
                </form>
              ) : (
                <p className="px-3 py-2 text-center text-sm text-muted-foreground">
                  רק מנהל המערכת וראש החברה יכולים לכתוב בערוץ ההודעות הרשמיות.
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
    {deleteTarget
      ? createPortal(
      <div className="fixed inset-0 z-[80] md:hidden">
        <button
          type="button"
          className="absolute inset-0 bg-black/40"
          aria-label="ביטול"
          disabled={deleting}
          onClick={() => setDeleteTarget(null)}
        />
        <div
          role="dialog"
          aria-labelledby="delete-message-title"
          className="absolute inset-x-0 bottom-16 rounded-t-3xl bg-white px-4 pt-3 pb-4 shadow-2xl"
        >
          <div className="mx-auto mb-3 h-1 w-10 rounded-full bg-black/15" />
          <h2 id="delete-message-title" className="text-base font-medium">
            למחוק את ההודעה?
          </h2>
          <p className="mt-1 text-sm leading-6 text-muted-foreground">
            ההודעה, כולל תמונות, סרטונים והודעות קוליות שצורפו אליה, תימחק מהצ׳אט.
            {deleteTarget.authorId !== me.id ? " אתם מוחקים הודעה של חבר." : ""}
          </p>
          <p className="mt-3 truncate rounded-xl bg-muted px-3 py-2 text-sm text-muted-foreground">
            {deletePreview(deleteTarget)}
          </p>
          <div className="mt-4 flex flex-col gap-2">
            <Button
              variant="destructive"
              className="h-12 w-full rounded-xl"
              disabled={deleting}
              onClick={() => void confirmDelete()}
            >
              <Trash2 data-icon="inline-start" />
              {deleting ? "מוחק…" : "מחק"}
            </Button>
            <Button
              variant="outline"
              className="h-12 w-full rounded-xl"
              disabled={deleting}
              onClick={() => setDeleteTarget(null)}
            >
              ביטול
            </Button>
          </div>
        </div>
      </div>,
      document.body
    )
      : null}
    </>
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
  me,
  members,
  last,
}: {
  channel: Channel;
  active: boolean;
  me: Member;
  members: Member[];
  last?: Message;
}) {
  const guide = isGuideChannel(channel, members);
  const label = guide
    ? guideChatTitle(channel, me, members)
    : channel.type === "dm"
      ? dmName(channel.name, channel.memberIds, me.id, (id) => members.find((m) => m.id === id)?.displayName ?? "")
      : channel.name;
  return (
    <Link
      href={`/chat/${channel.id}`}
      className={cn(
        "flex items-center gap-2 rounded-xl px-2 py-2 text-sm",
        guide && !active && "bg-[#f3f1ec] hover:bg-[#ece8e0]",
        guide && active && "bg-[#ece8e0] text-[#3f3a34]",
        !guide && active && "bg-primary/10 text-primary",
        !guide && !active && "hover:bg-black/5"
      )}
    >
      <RoomIcon channel={channel} members={members} />
      <div className="min-w-0 flex-1">
        <div className="truncate font-medium">{label}</div>
        <div className="truncate text-[11px] text-muted-foreground">
          {guide ? last?.text || "שיחה פרטית" : last?.text || "אין הודעות עדיין"}
        </div>
      </div>
    </Link>
  );
}

function RoomIcon({ channel, members = [] }: { channel: Channel; members?: Member[] }) {
  const guide = isGuideChannel(channel, members);
  const cls = cn(
    "flex size-8 items-center justify-center rounded-lg",
    guide ? "bg-[#ece8e0] text-[#5c564c]" : "bg-secondary text-primary"
  );
  if (guide)
    return (
      <span className={cls}>
        <BookOpen className="size-4" />
      </span>
    );
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

function onlineLabel(count: number) {
  if (count === 1) return "מחובר אחד כעת";
  return `${count} מחוברים כעת`;
}

function lastMessage(messages: Message[], channelId: string) {
  return messages
    .filter((m) => m.channelId === channelId)
    .sort((a, b) => +new Date(b.createdAt) - +new Date(a.createdAt))[0];
}

function groupChannels(channels: Channel[], members: Member[]) {
  return {
    rooms: channels.filter((c) => c.type !== "dm"),
    guides: channels.filter((c) => isGuideChannel(c, members)),
    dms: channels.filter((c) => c.type === "dm" && !isGuideChannel(c, members)),
  };
}

function deletePreview(message: Message) {
  if (message.text.trim()) return message.text;
  if (message.voiceUrl) return "הודעה קולית";
  const type = message.attachments[0]?.type;
  if (type === "image") return "תמונה";
  if (type === "video") return "סרטון";
  if (type === "audio") return "הודעה קולית";
  if (type) return "קובץ";
  return "הודעה";
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
