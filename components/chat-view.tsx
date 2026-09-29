"use client";

import { Fragment, useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  ArrowLeft,
  ArrowRight,
  BookOpen,
  Copy,
  Ellipsis,
  FileText,
  Forward,
  Hash,
  Megaphone,
  Mic,
  Paperclip,
  Pencil,
  Plus,
  Quote,
  Reply,
  Send,
  Smile,
  Trash2,
  Trees,
  Utensils,
  X,
} from "lucide-react";
import { toast } from "sonner";
import { useApp } from "@/components/app-provider";
import { NotificationToggle } from "@/components/chat-alerts";
import { ChatBubble } from "@/components/chat-bubble";
import { ChatSidebar, useChatReads } from "@/components/chat-sidebar";
import { ChatFileCard } from "@/components/chat-file-card";
import { SeenAvatar, TypingIndicator, useDmSeen, useTypers, useTypingSignal } from "@/components/chat-live";
import { ChatMediaGrid, isVisualAttachment } from "@/components/chat-media-grid";
import { EmojiPicker } from "@/components/emoji-picker";
import { PollCard } from "@/components/poll-card";
import { PollDialog } from "@/components/poll-dialog";
import { MediaProgressOverlay } from "@/components/media-progress";
import { UserAvatar } from "@/components/user-avatar";
import { VoiceNotePlayer } from "@/components/voice-note-player";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSub,
  DropdownMenuSubContent,
  DropdownMenuSubTrigger,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import {
  guideChatTitle,
  isGeneralChannel,
  isGuideChannel,
  isRoshChevra,
} from "@/lib/channels";
import { formatTimeHe, memberById } from "@/lib/format";
import { can, canDeleteMessage, isLeader } from "@/lib/permissions";
import { dmName } from "@/lib/selectors";
import type { Attachment, Channel, Member, Message } from "@/lib/types";
import {
  microphoneErrorMessage,
  pickRecorderMime,
  requestMicrophone,
} from "@/lib/microphone";
import {
  createLocalUpload,
  preloadMedia,
  uploadWithProgress,
  type LocalUpload,
} from "@/lib/upload-client";
import { cn } from "@/lib/utils";

type PendingChatUpload = {
  id: string;
  previewUrl: string;
  type: "image" | "video" | "audio" | "file";
  progress: number;
  remainingSeconds: number | null;
  name: string;
};

const MENU_EMOJIS = ["😊", "😂", "💥", "😐", "😌", "🚀"];

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
  const [pasted, setPasted] = useState<{ channelId: string; items: LocalUpload[] } | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<Message | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [menuMessage, setMenuMessage] = useState<Message | null>(null);
  const [menuView, setMenuView] = useState<"actions" | "forward" | "emoji">("actions");
  const [openMenuId, setOpenMenuId] = useState<string | null>(null);
  const [editing, setEditing] = useState<Message | null>(null);
  const [editDraft, setEditDraft] = useState("");
  const [savingEdit, setSavingEdit] = useState(false);
  const [flashId, setFlashId] = useState<string | null>(null);
  const [hoveredMessageId, setHoveredMessageId] = useState<string | null>(null);
  const [emojiOpenId, setEmojiOpenId] = useState<string | null>(null);
  const [pollOpen, setPollOpen] = useState(false);
  const [zoomMedia, setZoomMedia] = useState<{ src: string; type: "image" | "video" } | null>(null);
  const flashTimer = useRef<number | null>(null);
  const mediaRef = useRef<MediaRecorder | null>(null);
  const pendingChatRef = useRef<HTMLElement>(null);

  useEffect(() => {
    if (!zoomMedia) return;
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") setZoomMedia(null);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [zoomMedia]);

  const channels = useMemo(() => {
    if (!state || !me) return [];
    return state.channels.filter((c) => c.memberIds.includes(me.id));
  }, [state, me]);

  const active = channels.find((c) => c.id === channelId) ?? null;
  const messages = (state?.messages ?? [])
    .filter((m) => m.channelId === active?.id)
    .sort((a, b) => +new Date(a.createdAt) - +new Date(b.createdAt));
  const reads = useChatReads(active?.id ?? null, messages[messages.length - 1]?.id);
  useTypingSignal(active?.id ?? null, draft);
  const typerIds = useTypers(active?.id ?? null, me?.id);
  const seenAt = useDmSeen(active);
  const seenBy = useMemo(() => {
    const marks = new Map<string, string[]>();
    if (!me || active?.type !== "dm") return marks;
    for (const [memberId, at] of Object.entries(seenAt)) {
      const last = [...messages]
        .reverse()
        .find((message) => message.authorId === me.id && +new Date(message.createdAt) <= +new Date(at));
      if (last) marks.set(last.id, [...(marks.get(last.id) ?? []), memberId]);
    }
    return marks;
  }, [messages, seenAt, me, active?.type]);
  const leaderPolls =
    me && isRoshChevra(me)
      ? (state?.messages ?? [])
          .filter((message) => message.poll && !channels.some((channel) => channel.id === message.channelId))
          .sort((a, b) => +new Date(a.createdAt) - +new Date(b.createdAt))
      : [];

  function scrollPendingIntoView() {
    pendingChatRef.current?.scrollIntoView({ behavior: "auto", block: "center" });
  }

  useEffect(() => {
    if (pendingUploads.length) {
      scrollPendingIntoView();
      return;
    }
    endRef.current?.scrollIntoView({ behavior: "smooth", block: "end" });
  }, [messages.length, active?.id, pendingUploads.length, typerIds.length]);

  useEffect(() => {
    const el = composerRef.current;
    if (!el) return;
    const min = window.matchMedia("(min-width: 768px)").matches ? 40 : 36;
    el.style.height = `${min}px`;
    if (draft) el.style.height = `${Math.min(Math.max(el.scrollHeight, min), 112)}px`;
  }, [draft]);

  useEffect(() => {
    if (!state) return;
    const openReply = (id: string | null) => {
      if (!id) return false;
      const message = state.messages.find((item) => item.id === id);
      if (!message || (channelId && message.channelId !== channelId)) return false;
      sessionStorage.removeItem("chevra-reply");
      const url = new URL(window.location.href);
      if (url.searchParams.has("reply")) {
        url.searchParams.delete("reply");
        window.history.replaceState(null, "", `${url.pathname}${url.search}`);
      }
      setQuote({
        messageId: message.id,
        authorId: message.authorId,
        text: (message.poll?.question || message.text).slice(0, 140),
      });
      requestAnimationFrame(() => composerRef.current?.focus());
      return true;
    };
    const fromQuery = new URLSearchParams(window.location.search).get("reply");
    openReply(sessionStorage.getItem("chevra-reply") || fromQuery);
    const onEvent = (event: Event) => {
      openReply((event as CustomEvent<string>).detail);
    };
    window.addEventListener("chevra-open-reply", onEvent);
    return () => window.removeEventListener("chevra-open-reply", onEvent);
  }, [state, channelId]);

  useEffect(() => {
    if (channelId || channels.length === 0) return;
    if (!window.matchMedia("(min-width: 768px)").matches) return;
    const firstRoom = channels.find((c) => c.type !== "dm") ?? channels[0];
    if (firstRoom) router.replace(`/chat/${firstRoom.id}`);
  }, [channelId, channels, router]);

  if (!state || !me) return null;

  const guideActive = Boolean(active && isGuideChannel(active, state.members));
  const canWrite =
    active &&
    (isGeneralChannel(active) || active.type !== "announcements" || can(me, "postAnnouncement"));

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

  async function voteInPoll(messageId: string, optionId: string) {
    await act({ type: "votePoll", messageId, optionId });
  }

  async function send(extra?: Partial<Message>, caption?: string) {
    if (!active || !me || !state) return;
    const text = (caption ?? draft).trim();
    if (!extra?.voiceUrl && !extra?.attachments?.length && text.replace(/\s+/g, " ") === "התחל סקר") {
      if (!isLeader(me)) {
        toast.error("רק מנהל או ראש החברה יכולים לפתוח סקר");
        return;
      }
      setDraft("");
      setPollOpen(true);
      return;
    }
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

  function openMobileMenu(message: Message) {
    setMenuView("actions");
    setMenuMessage(message);
  }

  function quoteMessage(message: Message) {
    setQuote({
      messageId: message.id,
      authorId: message.authorId,
      text: (message.poll?.question || message.text).slice(0, 140),
    });
    setMenuMessage(null);
  }

  function beginEdit(message: Message) {
    setEditing(message);
    setEditDraft(message.poll?.question || message.text);
    setMenuMessage(null);
  }

  async function saveEdit() {
    if (!editing) return;
    setSavingEdit(true);
    try {
      await act({ type: "editMessage", messageId: editing.id, text: editDraft });
      setEditing(null);
      toast.success("ההודעה עודכנה");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "העריכה נכשלה");
    } finally {
      setSavingEdit(false);
    }
  }

  async function forwardMessageTo(message: Message, member: Member) {
    try {
      await act({ type: "forwardMessage", messageId: message.id, memberId: member.id });
      toast.success(`ההודעה הועברה אל ${forwardLabel(member, state?.members ?? [])}`);
      setMenuMessage(null);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "ההעברה נכשלה");
    }
  }

  function attach(files: FileList | null) {
    if (!files?.length || !active) return;
    stagePasted(Array.from(files));
    if (fileRef.current) fileRef.current.value = "";
    composerRef.current?.focus();
  }

  async function uploadAndSend(items: LocalUpload[], caption?: string) {
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

    const uploaded: (Attachment | null)[] = items.map(() => null);
    await Promise.all(
      items.map(async (item, index) => {
        try {
          const data = await uploadWithProgress(item.file, {}, ({ percent, remainingSeconds }) => {
            setPendingUploads((prev) =>
              prev.map((p) =>
                p.id === item.id ? { ...p, progress: percent, remainingSeconds } : p
              )
            );
          });
          await preloadMedia(data.url, item.type);
          uploaded[index] = {
            id: crypto.randomUUID(),
            type: item.type,
            url: data.url,
            name: item.name,
            size: item.file.size,
          };
        } catch (error) {
          toast.error(error instanceof Error ? error.message : "העלאה נכשלה");
        }
      })
    );

    const attachments = uploaded.filter((file): file is Attachment => file !== null);
    if (attachments.length) await send({ attachments }, caption);
    else if (caption?.trim()) setDraft(caption);
    items.forEach((item) => URL.revokeObjectURL(item.previewUrl));
    setPendingUploads((prev) => prev.filter((p) => !items.some((item) => item.id === p.id)));
  }

  const staged = pasted && active && pasted.channelId === active.id ? pasted.items : [];

  function stagePasted(files: File[]) {
    if (!active) return;
    const items = files.map((file) => createLocalUpload(file));
    setPasted((prev) => ({
      channelId: active.id,
      items: [...(prev?.channelId === active.id ? prev.items : []), ...items],
    }));
  }

  function unstage(id: string) {
    setPasted((prev) => {
      if (!prev) return prev;
      const gone = prev.items.find((item) => item.id === id);
      if (gone) URL.revokeObjectURL(gone.previewUrl);
      const items = prev.items.filter((item) => item.id !== id);
      return items.length ? { ...prev, items } : null;
    });
  }

  function submitComposer() {
    if (staged.length) {
      const caption = draft;
      setPasted(null);
      setDraft("");
      void uploadAndSend(staged, caption);
      return;
    }
    void send();
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
      className="flex h-full min-h-0 w-full flex-1 bg-white font-chat md:bg-transparent md:px-6 md:pt-3 md:pb-5"
    >
      <div className="flex min-h-0 min-w-0 flex-1 overflow-hidden md:h-full md:rounded-[1.75rem] md:bg-[var(--paper-card)] md:ring-1 md:ring-black/5">
      <ChatSidebar
        me={me}
        members={state.members}
        channels={channels}
        messages={state.messages}
        activeId={active?.id ?? null}
        onlineIds={onlineIds}
        reads={reads}
        onOpenPerson={(member) => void openPersonalChat(member)}
        top={
          leaderPolls.length ? (
            <div className="px-1 pt-3 md:hidden">
              <LeaderPolls messages={leaderPolls} me={me} members={state.members} onVote={voteInPoll} />
            </div>
          ) : null
        }
        className={cn(
          "w-full shrink-0 border-e border-black/5 md:w-80",
          active ? "hidden md:flex" : "flex"
        )}
      />

      <section
        className={cn(
          "min-h-0 min-w-0 flex-1 flex-col",
          guideActive ? "bg-[#f4f2ee] md:bg-[#f4f2ee]" : "bg-white",
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
              <NotificationToggle />
            </header>

            {leaderPolls.length ? (
              <div className="max-h-72 shrink-0 overflow-y-auto border-b border-black/5 px-3 py-3 md:px-6">
                <LeaderPolls messages={leaderPolls} me={me} members={state.members} onVote={voteInPoll} />
              </div>
            ) : null}

            <div
              className={cn(
                "min-h-0 flex-1 space-y-4 overflow-y-auto px-3 py-4 md:px-6",
                pendingUploads.length && "pb-28"
              )}
            >
              {messages.map((message, index) => {
                const previous = messages[index - 1];
                const newDay = !previous || !sameDay(previous.createdAt, message.createdAt);
                const continuation = Boolean(
                  previous &&
                    previous.authorId === message.authorId &&
                    sameMinute(previous.createdAt, message.createdAt)
                );
                const mine = message.authorId === me.id;
                const tightMedia =
                  !message.text.trim() &&
                  !message.quote &&
                  (Boolean(message.voiceUrl) || message.attachments.length > 0) &&
                  message.attachments.every((file) => file.type !== "file");
                const toolsOpen =
                  hoveredMessageId === message.id ||
                  openMenuId === message.id ||
                  emojiOpenId === message.id;
                const author = memberById(state.members, message.authorId);
                const quoted = message.quote
                  ? memberById(state.members, message.quote.authorId)
                  : null;
                return (
                  <Fragment key={message.id}>
                  {newDay ? (
                    <div className="flex justify-center pt-1">
                      <span className="rounded-full bg-white/85 px-3 py-0.5 text-[11px] text-[#5f6368] shadow-sm ring-1 ring-black/5">
                        {dayLabel(message.createdAt)}
                      </span>
                    </div>
                  ) : null}
                  <article
                    id={`message-${message.id}`}
                    className={cn(
                      "group flex scroll-my-4 gap-2 rounded-2xl transition-colors",
                      mine && "flex-row-reverse",
                      continuation && "-mt-3",
                      flashId === message.id && "bg-[#ece8e0]"
                    )}
                    onMouseEnter={() => setHoveredMessageId(message.id)}
                    onMouseLeave={() =>
                      setHoveredMessageId((current) => (current === message.id ? null : current))
                    }
                  >
                    {mine ? null : (
                      <UserAvatar member={author} size="sm" className={continuation ? "invisible" : undefined} />
                    )}
                    <div
                      className={cn(
                        "flex min-w-0 max-w-[min(85%,42rem)] flex-col",
                        mine ? "items-end" : "items-start"
                      )}
                    >
                      {continuation ? null : (
                        <div className="mb-0.5 flex items-baseline gap-2 px-1">
                          {mine ? null : (
                            <span className="text-xs text-[#1f1f1f]">{author?.displayName}</span>
                          )}
                          <span className="text-[11px] text-[#5f6368]">
                            {messageTime(message.createdAt)}
                          </span>
                        </div>
                      )}
                      <div className="relative w-fit max-w-full">
                      {message.poll ? (
                        <ChatBubble
                          canDelete={canDeleteMessage(me, message)}
                          onLongPress={() => openMobileMenu(message)}
                          className="w-fit max-w-full"
                        >
                          <PollCard
                            messageId={message.id}
                            poll={message.poll}
                            me={me}
                            members={state.members}
                            sentByMe={mine}
                            onVote={async (optionId) => {
                              await act({ type: "votePoll", messageId: message.id, optionId });
                            }}
                          />
                        </ChatBubble>
                      ) : (
                      <ChatBubble
                        canDelete={canDeleteMessage(me, message)}
                        onLongPress={() => openMobileMenu(message)}
                        onShortClick={
                          message.quote
                            ? () => jumpToMessage(message.quote!.messageId)
                            : undefined
                        }
                        className={cn(
                          "w-fit max-w-full rounded-[18px] text-[15px] leading-6 text-[#1f1f1f] shadow-none ring-0",
                          tightMedia
                            ? "bg-transparent p-0"
                            : cn(
                                message.quote ? "p-1 pb-1.5" : "px-3.5 py-1.5",
                                mine ? "bg-[#d3e3fd]" : "bg-[#f1f3f4]"
                              )
                        )}
                      >
                        {message.quote ? (
                          <div className="flex min-w-44 gap-2 rounded-[14px] bg-white px-3 py-2">
                            <Quote className="mt-1 size-3.5 shrink-0 fill-current text-[#a8b1dc]" />
                            <div className="min-w-0 leading-5">
                              <div className="text-[13px] text-[#1f1f1f]">{quoted?.displayName}</div>
                              <div className="truncate text-[13px] text-[#5f6368]">
                                {message.quote.text}
                              </div>
                            </div>
                          </div>
                        ) : null}
                        <div className={message.quote ? "px-2.5 pt-1" : undefined}>
                        {message.text ? <p className="whitespace-pre-wrap">{highlightMentions(message.text)}</p> : null}
                        {message.voiceUrl ? (
                          <VoiceNotePlayer src={message.voiceUrl} className={cn("ring-0", tightMedia ? (mine ? "bg-[#d3e3fd]" : "bg-[#f1f3f4]") : "mt-2 bg-white/70")} />
                        ) : null}
                        {message.attachments.some(isVisualAttachment) ? (
                          <ChatMediaGrid
                            items={message.attachments.filter(isVisualAttachment)}
                            onOpen={(file) => setZoomMedia({ src: file.url, type: file.type })}
                            className={tightMedia ? undefined : "my-1.5"}
                          />
                        ) : null}
                        {message.attachments.map((file) =>
                          isVisualAttachment(file) ? null : file.type === "audio" ? (
                            <VoiceNotePlayer key={file.id} src={file.url} className={cn("ring-0", tightMedia ? (mine ? "bg-[#d3e3fd]" : "bg-[#f1f3f4]") : "mt-2 bg-white/70")} />
                          ) : (
                            <ChatFileCard key={file.id} file={file} className="mt-1.5 first:mt-0" />
                          )
                        )}
                        </div>
                      </ChatBubble>
                      )}
                      <div
                        className={cn(
                          "absolute top-0 z-20 hidden -translate-y-1/2 items-center gap-0.5 rounded-full bg-white p-1 shadow-[0_4px_14px_rgba(40,50,70,0.14)] ring-1 ring-[#e6ebf0]",
                          mine ? "start-0" : "end-0",
                          toolsOpen && "md:flex"
                        )}
                      >
                        <MessageMenu
                          message={message}
                          me={me}
                          members={state.members}
                          active={active}
                          visible
                          onOpenChange={(open) => setOpenMenuId(open ? message.id : null)}
                          onEdit={() => beginEdit(message)}
                          onDelete={() => void deleteFromHover(message)}
                          onForward={(member) => void forwardMessageTo(message, member)}
                        />
                        <Button
                          variant="ghost"
                          size="icon"
                          className="rounded-full"
                          aria-label="השב"
                          onClick={() =>
                            setQuote({
                              messageId: message.id,
                              authorId: message.authorId,
                              text: message.text.slice(0, 140),
                            })
                          }
                        >
                          <Reply className="size-5" />
                        </Button>
                        <Popover
                          open={emojiOpenId === message.id}
                          onOpenChange={(open) => setEmojiOpenId(open ? message.id : null)}
                        >
                          <PopoverTrigger asChild>
                            <Button
                              variant="ghost"
                              size="icon"
                              className="rounded-full"
                              aria-label="תגובה"
                            >
                              <Smile className="size-5" />
                            </Button>
                          </PopoverTrigger>
                          <PopoverContent className="w-auto overflow-hidden rounded-2xl p-0" align="start">
                            <EmojiPicker
                              onPick={(emoji) => {
                                void act({ type: "react", messageId: message.id, emoji });
                                setEmojiOpenId(null);
                              }}
                            />
                          </PopoverContent>
                        </Popover>
                      </div>
                      {seenBy.get(message.id)?.slice(0, 1).map((memberId) => (
                        <SeenAvatar key={memberId} member={memberById(state.members, memberId)} />
                      ))}
                      </div>
                      {Object.keys(message.reactions).length > 0 ? (
                        <div className="mt-1 flex flex-wrap items-center gap-1">
                          {Object.entries(message.reactions).map(([emoji, ids]) => (
                            <button
                              key={emoji}
                              onClick={() => void act({ type: "react", messageId: message.id, emoji })}
                              className={cn(
                                "inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-sm leading-5 ring-1",
                                ids.includes(me.id) ? "bg-[#d3e3fd] ring-[#d3e3fd]" : "bg-white ring-[#dadce0]"
                              )}
                            >
                              {emoji}
                              <span className="text-xs text-[#0b57d0]">{ids.length}</span>
                            </button>
                          ))}
                        </div>
                      ) : null}
                    </div>
                  </article>
                  </Fragment>
                );
              })}
              {pendingUploads.length ? (
                <article ref={pendingChatRef} className="flex flex-row-reverse gap-2">
                  <div className="flex min-w-0 max-w-[min(85%,42rem)] flex-col items-end">
                    <div className="mb-0.5 px-1 text-[11px] text-[#5f6368]">מעלה…</div>
                    <div
                      className={cn(
                        "w-[12.5rem] max-w-full md:w-[17rem]",
                        pendingUploads.length > 1 && "grid grid-cols-2 gap-1"
                      )}
                    >
                      {pendingUploads.map((item, index) => (
                        <MediaProgressOverlay
                          key={item.id}
                          src={item.previewUrl}
                          type={item.type}
                          progress={item.progress}
                          remainingSeconds={item.remainingSeconds}
                          name={item.name}
                          className={cn(
                            "min-h-0",
                            item.type === "file"
                              ? "col-span-2 h-24 rounded-2xl"
                              : pendingUploads.length === 1
                              ? "aspect-square rounded-2xl"
                              : pendingUploads.length % 2 === 1 && index === 0
                                ? "col-span-2 aspect-[2/1] rounded-xl"
                                : "aspect-square rounded-xl"
                          )}
                          mediaClassName="size-full max-h-none object-cover"
                          onReady={scrollPendingIntoView}
                        />
                      ))}
                    </div>
                  </div>
                </article>
              ) : null}
              <TypingIndicator
                members={typerIds
                  .map((id) => memberById(state.members, id))
                  .filter((member): member is Member => Boolean(member))}
              />
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
              {canWrite && staged.length ? (
                <div className="mb-1.5 flex gap-2 overflow-x-auto px-1 pt-1 [scrollbar-width:none]">
                  {staged.map((item) => (
                    <div
                      key={item.id}
                      className="relative size-16 shrink-0 overflow-hidden rounded-xl bg-[#f1f3f4] ring-1 ring-black/10"
                    >
                      {item.type === "image" ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img src={item.previewUrl} alt={item.name} className="size-full object-cover" />
                      ) : item.type === "video" ? (
                        <video src={item.previewUrl} muted playsInline className="size-full object-cover" />
                      ) : (
                        <div className="flex size-full flex-col items-center justify-center gap-0.5 px-1 text-[#5f6368]">
                          {item.type === "audio" ? <Mic className="size-5" /> : <FileText className="size-5" />}
                          <span className="w-full truncate text-center text-[10px] leading-3" dir="ltr">
                            {item.name}
                          </span>
                        </div>
                      )}
                      <button
                        type="button"
                        aria-label="הסרה"
                        onClick={() => unstage(item.id)}
                        className="absolute end-0.5 top-0.5 flex size-5 items-center justify-center rounded-full bg-black/60 text-white"
                      >
                        <X className="size-3" />
                      </button>
                    </div>
                  ))}
                </div>
              ) : null}
              {canWrite ? (
                <form
                  className="flex items-center gap-0.5 md:gap-1"
                  onSubmit={(e) => {
                    e.preventDefault();
                    submitComposer();
                  }}
                >
                  <input
                    ref={fileRef}
                    type="file"
                    className="hidden"
                    multiple
                    onChange={(e) => attach(e.target.files)}
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
                          submitComposer();
                        }
                      }}
                      onPaste={(e) => {
                        const files = Array.from(e.clipboardData.files);
                        if (!files.length) return;
                        e.preventDefault();
                        stagePasted(files);
                      }}
                    />
                  </div>
                  <Popover>
                    <PopoverTrigger asChild>
                      <Button type="button" variant="ghost" size="icon" className="size-9 rounded-full md:size-10" aria-label="אימוג׳י">
                        <Smile />
                      </Button>
                    </PopoverTrigger>
                    <PopoverContent
                      side="top"
                      align="end"
                      collisionPadding={8}
                      className="w-auto overflow-hidden rounded-2xl p-0"
                    >
                      <EmojiPicker onPick={(emoji) => setDraft((d) => d + emoji)} />
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
          <div className="hidden flex-1 flex-col md:flex">
            {leaderPolls.length ? (
              <div className="overflow-y-auto px-6 py-4">
                <LeaderPolls messages={leaderPolls} me={me} members={state.members} onVote={voteInPoll} />
              </div>
            ) : null}
            <div className="flex flex-1 items-center justify-center text-muted-foreground">בחרו שיחה מהרשימה</div>
          </div>
        )}
      </section>
      </div>
      {zoomMedia
        ? createPortal(
            <div
              className="fixed inset-0 z-[90] flex items-center justify-center bg-black/80 p-4 pt-16"
              onClick={() => setZoomMedia(null)}
            >
              <button
                type="button"
                className="absolute top-4 left-4 z-10 flex size-9 items-center justify-center rounded-full bg-white text-xl leading-none text-[#1f2328]"
                aria-label="סגירה"
                onClick={() => setZoomMedia(null)}
              >
                ×
              </button>
              {zoomMedia.type === "video" ? (
                <video
                  src={zoomMedia.src}
                  controls
                  autoPlay
                  playsInline
                  className="max-h-[calc(100dvh-6rem)] max-w-[92vw] bg-black"
                  onClick={(event) => event.stopPropagation()}
                />
              ) : (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={zoomMedia.src}
                  alt=""
                  className="h-[calc(100dvh-6rem)] max-h-[calc(100dvh-6rem)] w-auto max-w-[92vw] object-contain"
                  onClick={(event) => event.stopPropagation()}
                />
              )}
            </div>,
            document.body
          )
        : null}
    </div>
    {menuMessage
      ? createPortal(
          <div className="fixed inset-0 z-[80] md:hidden">
            <button
              type="button"
              className="absolute inset-0 bg-black/40"
              aria-label="ביטול"
              onClick={() => setMenuMessage(null)}
            />
            <div
              role="dialog"
              aria-labelledby="message-menu-title"
              className="absolute inset-x-0 bottom-16 max-h-[70dvh] overflow-y-auto rounded-t-3xl bg-white px-4 pt-3 pb-4 font-chat shadow-2xl"
            >
              <div className="mx-auto mb-3 h-1 w-10 rounded-full bg-black/15" />
              {menuView === "emoji" ? (
                <>
                  <h2 id="message-menu-title" className="sr-only">
                    אימוג׳ים
                  </h2>
                  <EmojiPicker
                    className="-mx-2 h-[min(26rem,55dvh)] w-auto"
                    onPick={(emoji) => {
                      void act({ type: "react", messageId: menuMessage.id, emoji });
                      setMenuMessage(null);
                    }}
                  />
                </>
              ) : menuView === "actions" ? (
                <>
                  <div className="mb-4 flex justify-between gap-2">
                    {MENU_EMOJIS.map((emoji) => (
                      <button
                        key={emoji}
                        type="button"
                        className="flex size-11 items-center justify-center rounded-full bg-[#f3f4f6] text-[22px]"
                        onClick={() => {
                          void act({ type: "react", messageId: menuMessage.id, emoji });
                          setMenuMessage(null);
                        }}
                      >
                        {emoji}
                      </button>
                    ))}
                    <button
                      type="button"
                      aria-label="כל האימוג׳ים"
                      className="flex size-11 items-center justify-center rounded-full bg-[#f3f4f6] text-[#444746]"
                      onClick={() => setMenuView("emoji")}
                    >
                      <Plus className="size-5" />
                    </button>
                  </div>
                  <h2 id="message-menu-title" className="sr-only">
                    אפשרויות
                  </h2>
                  <p className="mt-3 truncate rounded-xl bg-muted px-3 py-2 text-sm text-muted-foreground">
                    {deletePreview(menuMessage)}
                  </p>
                  <div className="mt-4 flex flex-col gap-2">
                    {copyableText(menuMessage) ? (
                      <Button
                        className="h-12 w-full rounded-xl"
                        variant="outline"
                        onClick={() => {
                          const text = copyableText(menuMessage);
                          setMenuMessage(null);
                          void copyText(text).then(
                            () => toast.success("ההודעה הועתקה"),
                            () => toast.error("ההעתקה נכשלה")
                          );
                        }}
                      >
                        <Copy data-icon="inline-start" />
                        העתקה
                      </Button>
                    ) : null}
                    {menuMessage.authorId === me.id ? (
                      <Button className="h-12 w-full rounded-xl" variant="outline" onClick={() => beginEdit(menuMessage)}>
                        <Pencil data-icon="inline-start" />
                        עריכה
                      </Button>
                    ) : null}
                    {canDeleteMessage(me, menuMessage) ? (
                      <Button
                        className="h-12 w-full rounded-xl"
                        variant="destructive"
                        onClick={() => {
                          setDeleteTarget(menuMessage);
                          setMenuMessage(null);
                        }}
                      >
                        <Trash2 data-icon="inline-start" />
                        מחיקה
                      </Button>
                    ) : null}
                    <Button className="h-12 w-full rounded-xl" variant="outline" onClick={() => quoteMessage(menuMessage)}>
                      <Quote data-icon="inline-start" />
                      ציטוט בתשובה
                    </Button>
                    <Button
                      className="h-12 w-full rounded-xl"
                      variant="outline"
                      onClick={() => setMenuView("forward")}
                    >
                      <Forward data-icon="inline-start" />
                      העברה לצ׳אט אחר
                    </Button>
                  </div>
                </>
              ) : (
                <>
                  <h2 id="message-menu-title" className="text-base font-medium">
                    העברה לצ׳אט אחר
                  </h2>
                  <div className="mt-4 flex flex-col gap-2">
                    {forwardTargets(state.members, me, active).map((member) => (
                      <Button
                        key={member.id}
                        className="h-12 w-full justify-start rounded-xl"
                        variant="outline"
                        onClick={() => void forwardMessageTo(menuMessage, member)}
                      >
                        {forwardLabel(member, state.members)}
                      </Button>
                    ))}
                  </div>
                  <Button className="mt-3 h-12 w-full rounded-xl" variant="ghost" onClick={() => setMenuView("actions")}>
                    חזרה
                  </Button>
                </>
              )}
            </div>
          </div>,
          document.body
        )
      : null}
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
    {active ? (
      <PollDialog channelId={active.id} open={pollOpen} onOpenChange={setPollOpen} />
    ) : null}
    <Dialog
      open={editing !== null}
      onOpenChange={(open) => {
        if (!open) setEditing(null);
      }}
    >
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>עריכת הודעה</DialogTitle>
        </DialogHeader>
        <textarea
          value={editDraft}
          onChange={(event) => setEditDraft(event.target.value)}
          rows={4}
          className="w-full resize-none rounded-xl border border-input bg-white px-3 py-2 text-sm outline-none focus-visible:ring-2 focus-visible:ring-ring/40"
        />
        <Button type="button" disabled={savingEdit} onClick={() => void saveEdit()}>
          {savingEdit ? "שומר…" : "שמירה"}
        </Button>
      </DialogContent>
    </Dialog>
    </>
  );
}

const menuItemClass = "gap-2 whitespace-nowrap px-2.5 py-1.5 text-sm";

function MessageMenu({
  message,
  me,
  members,
  active,
  visible,
  onOpenChange,
  onEdit,
  onDelete,
  onForward,
}: {
  message: Message;
  me: Member;
  members: Member[];
  active: Channel | null;
  visible: boolean;
  onOpenChange: (open: boolean) => void;
  onEdit: () => void;
  onDelete: () => void;
  onForward: (member: Member) => void;
}) {
  const targets = forwardTargets(members, me, active);
  return (
    <DropdownMenu dir="rtl" onOpenChange={onOpenChange}>
      <DropdownMenuTrigger asChild>
        <Button
          type="button"
          variant="ghost"
          size="icon"
          aria-label="אפשרויות"
          data-message-menu=""
          className={cn(
            "rounded-full",
            visible ? "hidden md:inline-flex" : "hidden"
          )}
        >
          <Ellipsis className="size-5" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-auto min-w-40 p-1 font-chat">
        {message.authorId === me.id ? (
          <DropdownMenuItem className={menuItemClass} onSelect={onEdit}>
            <Pencil className="size-4" />
            עריכה
          </DropdownMenuItem>
        ) : null}
        {canDeleteMessage(me, message) ? (
          <DropdownMenuItem className={menuItemClass} variant="destructive" onSelect={onDelete}>
            <Trash2 className="size-4" />
            מחיקה
          </DropdownMenuItem>
        ) : null}
        <DropdownMenuSub>
          <DropdownMenuSubTrigger className={menuItemClass}>
            <Forward className="size-4" />
            העברה לצ׳אט אחר
          </DropdownMenuSubTrigger>
          <DropdownMenuSubContent className="max-h-64 min-w-36 overflow-y-auto p-1 font-chat">
            {targets.length ? (
              targets.map((member) => (
                <DropdownMenuItem
                  key={member.id}
                  className={menuItemClass}
                  onSelect={() => onForward(member)}
                >
                  {forwardLabel(member, members)}
                </DropdownMenuItem>
              ))
            ) : (
              <DropdownMenuItem className={menuItemClass} disabled>
                אין שיחה להעביר אליה
              </DropdownMenuItem>
            )}
          </DropdownMenuSubContent>
        </DropdownMenuSub>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

function forwardTargets(members: Member[], me: Member, active: Channel | null) {
  return members
    .filter((member) => {
      if (member.id === me.id) return false;
      if (
        active?.type === "dm" &&
        active.memberIds.length === 2 &&
        active.memberIds.includes(member.id)
      ) {
        return false;
      }
      return true;
    })
    .sort((a, b) => Number(isRoshChevra(b)) - Number(isRoshChevra(a)) || a.displayName.localeCompare(b.displayName, "he"));
}

function forwardLabel(member: Member, members: Member[]) {
  if (!isRoshChevra(member)) return member.displayName;
  const leaders = members.filter((item) => isRoshChevra(item)).length;
  return leaders > 1 ? `ראש החברה · ${member.displayName}` : "ראש החברה";
}

function LeaderPolls({
  messages,
  me,
  members,
  onVote,
}: {
  messages: Message[];
  me: Member;
  members: Member[];
  onVote: (messageId: string, optionId: string) => Promise<void>;
}) {
  return (
    <div className="mb-4 space-y-3">
      <div className="text-[11px] font-medium tracking-wide text-muted-foreground">סקרים</div>
      {messages.map((message) =>
        message.poll ? (
          <PollCard
            key={message.id}
            messageId={message.id}
            poll={message.poll}
            me={me}
            members={members}
            sentByMe={message.authorId === me.id}
            onVote={(optionId) => onVote(message.id, optionId)}
          />
        ) : null
      )}
    </div>
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

function sameDay(a: string, b: string) {
  return new Date(a).toDateString() === new Date(b).toDateString();
}

function daysAgo(iso: string) {
  const day = new Date(iso);
  day.setHours(0, 0, 0, 0);
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  return Math.round((today.getTime() - day.getTime()) / 86_400_000);
}

function dayLabel(iso: string) {
  const diff = daysAgo(iso);
  if (diff <= 0) return "היום";
  if (diff === 1) return "אתמול";
  const date = new Date(iso);
  if (diff < 7) return new Intl.DateTimeFormat("he-IL", { weekday: "long" }).format(date);
  const sameYear = date.getFullYear() === new Date().getFullYear();
  return new Intl.DateTimeFormat("he-IL", {
    weekday: "long",
    day: "numeric",
    month: "long",
    ...(sameYear ? {} : { year: "numeric" }),
  }).format(date);
}

function messageTime(iso: string) {
  const time = formatTimeHe(iso);
  const diff = daysAgo(iso);
  if (diff <= 0) return time;
  if (diff === 1) return `אתמול ${time}`;
  const date = new Date(iso);
  if (diff < 7) return `${new Intl.DateTimeFormat("he-IL", { weekday: "short" }).format(date)} ${time}`;
  return `${new Intl.DateTimeFormat("he-IL", { day: "numeric", month: "numeric" }).format(date)} ${time}`;
}

function sameMinute(a: string, b: string) {
  const left = new Date(a);
  const right = new Date(b);
  return (
    left.getFullYear() === right.getFullYear() &&
    left.getMonth() === right.getMonth() &&
    left.getDate() === right.getDate() &&
    left.getHours() === right.getHours() &&
    left.getMinutes() === right.getMinutes()
  );
}

function onlineLabel(count: number) {
  if (count === 1) return "מחובר אחד כעת";
  return `${count} מחוברים כעת`;
}

function copyableText(message: Message) {
  if (message.poll) {
    return [message.poll.question, ...message.poll.options.map((option) => `• ${option.label}`)].join("\n");
  }
  return message.text.trim() ? message.text : "";
}

async function copyText(text: string) {
  if (navigator.clipboard && window.isSecureContext) {
    await navigator.clipboard.writeText(text);
    return;
  }
  const area = document.createElement("textarea");
  area.value = text;
  area.setAttribute("readonly", "");
  area.style.position = "fixed";
  area.style.opacity = "0";
  document.body.appendChild(area);
  area.select();
  const ok = document.execCommand("copy");
  area.remove();
  if (!ok) throw new Error("copy failed");
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
