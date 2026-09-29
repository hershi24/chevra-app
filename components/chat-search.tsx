"use client";

import { Fragment } from "react";
import { UserAvatar } from "@/components/user-avatar";
import { memberById } from "@/lib/format";
import type { Channel, Member, Message } from "@/lib/types";
import { cn } from "@/lib/utils";

export type SearchFilter = "all" | "media" | "files" | "links";

export const SEARCH_FILTERS: { id: SearchFilter; label: string }[] = [
  { id: "all", label: "הכל" },
  { id: "media", label: "תמונות וסרטונים" },
  { id: "files", label: "קבצים" },
  { id: "links", label: "קישורים" },
];

export const JUMP_KEY = "chevra-jump";
export type JumpRequest = { messageId: string; q: string };

const LINK = /(https?:\/\/|www\.)\S+/i;
const NIQQUD = /[\u0591-\u05C7]/g;

function normalize(text: string) {
  return text.replace(NIQQUD, "").toLowerCase();
}

function escapeRegExp(text: string) {
  return text.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function searchable(message: Message) {
  return [message.poll?.question ?? "", message.text, ...message.attachments.map((file) => file.name ?? "")].join("\n");
}

function ofKind(message: Message, filter: SearchFilter) {
  if (filter === "media") return message.attachments.some((file) => file.type === "image" || file.type === "video");
  if (filter === "files") {
    return Boolean(message.voiceUrl) || message.attachments.some((file) => file.type === "file" || file.type === "audio");
  }
  if (filter === "links") return LINK.test(message.text);
  return true;
}

export function searchMessages(messages: Message[], channelIds: Set<string>, query: string, filter: SearchFilter) {
  const q = normalize(query.trim());
  if (!q && filter === "all") return [];
  return messages
    .filter(
      (message) =>
        channelIds.has(message.channelId) &&
        ofKind(message, filter) &&
        (!q || normalize(searchable(message)).includes(q))
    )
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt));
}

/** Wraps every occurrence of `term` in a highlight; untouched text when there is no term. */
export function markText(text: string, term: string | undefined) {
  const q = term?.trim();
  if (!q) return text;
  const parts = text.split(new RegExp(`(${escapeRegExp(q)})`, "gi"));
  if (parts.length === 1) return text;
  return parts.map((part, index) =>
    index % 2 ? (
      <mark key={index} className="rounded-[3px] bg-[#fbe7b5] px-0.5 text-inherit">
        {part}
      </mark>
    ) : (
      <Fragment key={index}>{part}</Fragment>
    )
  );
}

function snippet(message: Message, query: string) {
  const text = (message.poll ? `סקר: ${message.poll.question}` : message.text).replace(/\s+/g, " ").trim();
  const kind = message.attachments.some((file) => file.type === "image")
    ? "תמונה"
    : message.attachments.some((file) => file.type === "video")
      ? "סרטון"
      : message.voiceUrl
        ? "הודעה קולית"
        : message.attachments.length
          ? message.attachments[0].name || "קובץ"
          : "";
  const base = text || kind;
  const at = normalize(base).indexOf(normalize(query.trim()));
  const body = at > 30 ? `…${base.slice(at - 24)}` : base;
  return text && kind ? `${kind} · ${body}` : body;
}

function resultTime(iso: string) {
  const date = new Date(iso);
  const today = new Date();
  const sameDay = date.toDateString() === today.toDateString();
  const time = new Intl.DateTimeFormat("he-IL", { hour: "2-digit", minute: "2-digit" }).format(date);
  if (sameDay) return `היום ${time}`;
  return new Intl.DateTimeFormat("he-IL", {
    day: "numeric",
    month: "numeric",
    ...(date.getFullYear() === today.getFullYear() ? {} : { year: "2-digit" }),
  }).format(date);
}

export function MessageResult({
  message,
  query,
  members,
  channel,
  channelTitle,
  active,
  onOpen,
}: {
  message: Message;
  query: string;
  members: Member[];
  channel: Channel;
  channelTitle: string;
  active: boolean;
  onOpen: () => void;
}) {
  const author = memberById(members, message.authorId);
  const image = message.attachments.find((file) => file.type === "image");
  const where = channel.type === "dm" ? `פרטי עם ${channelTitle}` : channelTitle;
  return (
    <button
      type="button"
      onClick={onOpen}
      className={cn(
        "flex w-full items-start gap-3 rounded-2xl px-2.5 py-2 text-start transition",
        active ? "bg-white shadow-[0_1px_3px_rgba(20,30,40,0.06),0_0_0_1px_#edf0f3]" : "hover:bg-black/[0.03]"
      )}
    >
      {image ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={image.url} alt="" className="size-10 shrink-0 rounded-xl object-cover" />
      ) : (
        <UserAvatar member={author} />
      )}
      <div className="min-w-0 flex-1">
        <div className="flex items-baseline gap-2">
          <span className="truncate text-[13.5px] font-normal">
            {author?.displayName ?? "חבר"}
            <span className="text-muted-foreground"> · {where}</span>
          </span>
          <time className="ms-auto shrink-0 font-chat text-[11px] text-muted-foreground/80">
            {resultTime(message.createdAt)}
          </time>
        </div>
        <p className="mt-0.5 line-clamp-2 font-chat text-[12.5px] leading-5 text-muted-foreground">
          {markText(snippet(message, query), query)}
        </p>
      </div>
    </button>
  );
}
