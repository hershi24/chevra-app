"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import {
  BookOpen,
  Hash,
  Megaphone,
  Pencil,
  Search,
  Trees,
  Utensils,
} from "lucide-react";
import { UserAvatar } from "@/components/user-avatar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { guideChatTitle, isGuideChannel, isRoshChevra } from "@/lib/channels";
import { memberById } from "@/lib/format";
import { dmName } from "@/lib/selectors";
import type { Channel, Member, Message } from "@/lib/types";
import { cn } from "@/lib/utils";

const BASELINE = "*";

type Reads = Record<string, string>;

function latestReads(prev: Reads | null, next: Reads): Reads {
  const out: Reads = { ...(prev ?? {}) };
  for (const [key, value] of Object.entries(next)) {
    if (!out[key] || out[key] < value) out[key] = value;
  }
  return out;
}

export function useChatReads(activeId: string | null, lastActiveMessageId: string | undefined) {
  const [reads, setReads] = useState<Reads | null>(null);

  useEffect(() => {
    let cancelled = false;
    const load = () => {
      fetch("/api/chat/read", { cache: "no-store" })
        .then((res) => (res.ok ? res.json() : null))
        .then((data: { reads?: Reads } | null) => {
          if (!cancelled && data?.reads) setReads((prev) => latestReads(prev, data.reads!));
        })
        .catch(() => undefined);
    };
    load();
    const onVisible = () => {
      if (document.visibilityState === "visible") load();
    };
    document.addEventListener("visibilitychange", onVisible);
    return () => {
      cancelled = true;
      document.removeEventListener("visibilitychange", onVisible);
    };
  }, []);

  useEffect(() => {
    if (!activeId) return;
    const mark = () => {
      if (document.visibilityState !== "visible") return;
      fetch("/api/chat/read", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ channelId: activeId }),
      })
        .then((res) => (res.ok ? res.json() : null))
        .then((data: { channelId?: string; at?: string } | null) => {
          if (data?.channelId && data.at) {
            setReads((prev) => latestReads(prev, { [data.channelId!]: data.at! }));
          }
        })
        .catch(() => undefined);
    };
    mark();
    document.addEventListener("visibilitychange", mark);
    return () => document.removeEventListener("visibilitychange", mark);
  }, [activeId, lastActiveMessageId]);

  return reads;
}

function preview(message: Message) {
  if (message.poll) return `סקר: ${message.poll.question}`;
  if (message.text.trim()) return message.text;
  if (message.voiceUrl) return "הודעה קולית";
  const type = message.attachments[0]?.type;
  if (type === "image") return "תמונה";
  if (type === "video") return "סרטון";
  if (type === "audio") return "הקלטה";
  return type ? "קובץ" : "";
}

function listTime(iso: string) {
  const date = new Date(iso);
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const day = new Date(date);
  day.setHours(0, 0, 0, 0);
  const diff = Math.round((today.getTime() - day.getTime()) / 86_400_000);
  if (diff <= 0) return new Intl.DateTimeFormat("he-IL", { hour: "2-digit", minute: "2-digit" }).format(date);
  if (diff === 1) return "אתמול";
  if (diff < 7) return new Intl.DateTimeFormat("he-IL", { weekday: "short" }).format(date);
  return new Intl.DateTimeFormat("he-IL", { day: "numeric", month: "numeric" }).format(date);
}

function RoomGlyph({ channel, guide }: { channel: Channel; guide: boolean }) {
  const cls = "size-[18px]";
  if (guide) return <BookOpen className={cls} aria-hidden />;
  if (channel.type === "announcements") return <Megaphone className={cls} aria-hidden />;
  if (channel.name.includes("כיבוד")) return <Utensils className={cls} aria-hidden />;
  if (channel.name.includes("טיול")) return <Trees className={cls} aria-hidden />;
  return <Hash className={cls} aria-hidden />;
}

type Row = {
  channel: Channel;
  title: string;
  tag?: string;
  guide: boolean;
  other?: Member;
  last?: Message;
  unread: number;
};

export function ChatSidebar({
  me,
  members,
  channels,
  messages,
  activeId,
  onlineIds,
  reads,
  onOpenPerson,
  top,
  className,
}: {
  me: Member;
  members: Member[];
  channels: Channel[];
  messages: Message[];
  activeId: string | null;
  onlineIds: string[];
  reads: Reads | null;
  onOpenPerson: (member: Member) => void;
  top?: React.ReactNode;
  className?: string;
}) {
  const [query, setQuery] = useState("");
  const [newOpen, setNewOpen] = useState(false);
  const online = useMemo(() => new Set(onlineIds), [onlineIds]);
  const others = useMemo(
    () =>
      members
        .filter((member) => member.id !== me.id)
        .sort((a, b) => Number(online.has(b.id)) - Number(online.has(a.id))),
    [members, me.id, online]
  );

  const rows = useMemo(() => {
    const lastBy = new Map<string, Message>();
    const unreadBy = new Map<string, number>();
    const baseline = reads?.[BASELINE];
    for (const message of messages) {
      const prev = lastBy.get(message.channelId);
      if (!prev || prev.createdAt < message.createdAt) lastBy.set(message.channelId, message);
      if (!reads || message.authorId === me.id || message.channelId === activeId) continue;
      const since = reads[message.channelId] ?? baseline;
      if (since && message.createdAt > since) {
        unreadBy.set(message.channelId, (unreadBy.get(message.channelId) ?? 0) + 1);
      }
    }
    return channels.map<Row>((channel) => {
      const guide = isGuideChannel(channel, members);
      const otherId = channel.memberIds.find((id) => id !== me.id);
      const other = otherId ? memberById(members, otherId) : undefined;
      let title = channel.name;
      let tag: string | undefined;
      if (guide) {
        if (isRoshChevra(me)) title = guideChatTitle(channel, me, members);
        else {
          title = other?.displayName ?? guideChatTitle(channel, me, members);
          tag = "ראש החברה";
        }
      } else if (channel.type === "dm") {
        title = dmName(channel.name, channel.memberIds, me.id, (id) => memberById(members, id)?.displayName ?? "");
      }
      return {
        channel,
        title,
        tag,
        guide,
        other: channel.type === "dm" && !guide ? other : undefined,
        last: lastBy.get(channel.id),
        unread: unreadBy.get(channel.id) ?? 0,
      };
    });
  }, [channels, members, messages, me, reads, activeId]);

  const q = query.trim();
  const match = (row: Row) =>
    !q || row.title.includes(q) || (row.last ? preview(row.last).includes(q) : false);
  const byRecent = (a: Row, b: Row) => (b.last?.createdAt ?? "").localeCompare(a.last?.createdAt ?? "");
  const rooms = rows.filter((row) => row.channel.type !== "dm" && !row.guide && match(row));
  const guides = rows.filter((row) => row.guide && match(row)).sort(byRecent);
  const dms = rows.filter((row) => row.channel.type === "dm" && !row.guide && match(row)).sort(byRecent);
  const onlineOthers = others.filter((member) => online.has(member.id)).length;

  const rowProps = (row: Row) => ({
    row,
    active: row.channel.id === activeId,
    me,
    members,
    online: row.other ? online.has(row.other.id) : false,
  });

  return (
    <aside className={cn("flex min-h-0 min-w-0 flex-col bg-[#f8f9fa] font-sans", className)}>
      <div className="space-y-3 px-4 pb-3 pt-4 md:pt-5">
        <div className="flex items-start justify-between gap-3">
          <div>
            <h1 className="text-[1.3rem] font-normal tracking-tight">צ׳אט החבורה</h1>
            <p className="mt-0.5 flex items-center gap-1.5 text-[12px] font-light text-muted-foreground">
              <span className={cn("size-[7px] rounded-full", onlineOthers ? "bg-[#3ba55d]" : "bg-black/20")} />
              {onlineOthers === 1 ? "מחובר אחד עכשיו" : `${onlineOthers} מחוברים עכשיו`}
            </p>
          </div>
          <Popover open={newOpen} onOpenChange={setNewOpen}>
            <PopoverTrigger
              aria-label="שיחה חדשה"
              title="שיחה חדשה"
              className="grid size-9 shrink-0 place-items-center rounded-xl border border-[#e3e7ec] bg-white text-primary outline-none hover:border-[#cfd5dd]"
            >
              <Pencil className="size-4" />
            </PopoverTrigger>
            <PopoverContent
              dir="rtl"
              align="end"
              className="w-[min(19rem,calc(100vw-2rem))] gap-1 rounded-2xl p-2.5 font-sans"
            >
              <NewChatList
                members={others}
                online={online}
                onPick={(member) => {
                  setNewOpen(false);
                  onOpenPerson(member);
                }}
              />
            </PopoverContent>
          </Popover>
        </div>
        <label className="flex items-center gap-2 rounded-xl border border-[#e3e7ec] bg-white px-3 py-2">
          <Search className="size-4 shrink-0 text-muted-foreground/70" aria-hidden />
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="חיפוש בשיחות"
            className="min-w-0 flex-1 bg-transparent text-[13px] font-normal outline-none placeholder:text-muted-foreground/70"
          />
        </label>
      </div>

      <div className="flex gap-3 overflow-x-auto border-b border-[#e9ecef] px-4 pb-3.5 pt-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
        {others.map((member) => (
          <button
            key={member.id}
            type="button"
            onClick={() => onOpenPerson(member)}
            className="flex w-12 shrink-0 flex-col items-center gap-1"
          >
            <PresenceAvatar member={member} online={online.has(member.id)} ring="ring-[#f8f9fa]" />
            <span className="w-full truncate text-center text-[11px] font-light text-foreground/75">
              {member.displayName.split(" ")[0]}
            </span>
          </button>
        ))}
      </div>

      <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-2 pb-6">
        {top}
        {rooms.length ? (
          <Section title="ערוצים">
            {rooms.map((row) => (
              <ChannelRow key={row.channel.id} {...rowProps(row)} />
            ))}
          </Section>
        ) : null}
        {guides.length ? (
          <Section title={isRoshChevra(me) ? "שיחות עם חברים" : "ראש החברה"}>
            {guides.map((row) => (
              <ChannelRow key={row.channel.id} {...rowProps(row)} />
            ))}
          </Section>
        ) : null}
        {dms.length ? (
          <Section title="שיחות אישיות">
            {dms.map((row) => (
              <ChannelRow key={row.channel.id} {...rowProps(row)} />
            ))}
          </Section>
        ) : null}
        {q && !rooms.length && !guides.length && !dms.length ? (
          <p className="px-3 py-8 text-center text-[13px] font-light text-muted-foreground">
            לא נמצאו שיחות
          </p>
        ) : null}
      </div>
    </aside>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="pt-3">
      <div className="px-2.5 pb-1 text-[11px] font-light tracking-wide text-muted-foreground">{title}</div>
      <div className="space-y-0.5">{children}</div>
    </div>
  );
}

function PresenceAvatar({
  member,
  online,
  ring,
  size = "default",
}: {
  member: Member;
  online: boolean;
  ring: string;
  size?: "default" | "sm";
}) {
  return (
    <span className="relative inline-flex shrink-0">
      <UserAvatar member={member} size={size} />
      {online ? (
        <span
          className={cn(
            "absolute -bottom-px -left-px size-2.5 rounded-full bg-[#3ba55d] ring-2",
            ring
          )}
        />
      ) : null}
    </span>
  );
}

function ChannelRow({
  row,
  active,
  me,
  members,
  online,
}: {
  row: Row;
  active: boolean;
  me: Member;
  members: Member[];
  online: boolean;
}) {
  const author = row.last ? memberById(members, row.last.authorId) : undefined;
  const who =
    row.last && row.channel.type !== "dm"
      ? row.last.authorId === me.id
        ? "אתה"
        : author?.displayName.split(" ")[0]
      : row.last?.authorId === me.id
        ? "אתה"
        : undefined;
  const text = row.last ? preview(row.last) : "אין הודעות עדיין";
  const unread = row.unread > 0;

  return (
    <Link
      href={`/chat/${row.channel.id}`}
      className={cn(
        "flex items-center gap-3 rounded-2xl px-2.5 py-2.5 transition",
        active
          ? "md:bg-white md:shadow-[0_1px_3px_rgba(20,30,40,0.06),0_0_0_1px_#edf0f3]"
          : "hover:bg-black/[0.03]"
      )}
    >
      {row.other ? (
        <PresenceAvatar member={row.other} online={online} ring={active ? "md:ring-white ring-[#f8f9fa]" : "ring-[#f8f9fa]"} />
      ) : (
        <span
          className={cn(
            "grid size-10 shrink-0 place-items-center rounded-xl",
            row.guide || active ? "bg-[#f5f0e7] text-primary" : "bg-[#eef0f3] text-[#7a818b]"
          )}
        >
          <RoomGlyph channel={row.channel} guide={row.guide} />
        </span>
      )}
      <div className="min-w-0 flex-1">
        <div className="flex items-baseline gap-2">
          <span className="truncate text-[14px] font-normal">{row.title}</span>
          {row.tag ? (
            <span className="shrink-0 rounded-full bg-[#f5f0e7] px-1.5 py-px text-[10.5px] font-light text-primary">
              {row.tag}
            </span>
          ) : null}
          {row.last ? (
            <time
              className={cn(
                "ms-auto shrink-0 font-chat text-[11px]",
                unread ? "text-primary" : "text-muted-foreground/80"
              )}
            >
              {listTime(row.last.createdAt)}
            </time>
          ) : null}
        </div>
        <div className="mt-0.5 flex items-center gap-2">
          <p
            className={cn(
              "min-w-0 flex-1 truncate font-chat text-[12.5px]",
              unread ? "text-foreground/80" : "text-muted-foreground"
            )}
          >
            {who ? <span className="text-foreground/70">{who}: </span> : null}
            {text}
          </p>
          {unread ? (
            <span className="grid h-[19px] min-w-[19px] shrink-0 place-items-center rounded-full bg-primary px-1.5 font-chat text-[11px] text-primary-foreground">
              {row.unread > 99 ? "99+" : row.unread}
            </span>
          ) : null}
        </div>
      </div>
    </Link>
  );
}

function NewChatList({
  members,
  online,
  onPick,
}: {
  members: Member[];
  online: Set<string>;
  onPick: (member: Member) => void;
}) {
  const [query, setQuery] = useState("");
  const list = members.filter((member) => member.displayName.includes(query.trim()));
  const on = list.filter((member) => online.has(member.id));
  const off = list.filter((member) => !online.has(member.id));
  const item = (member: Member) => (
    <button
      key={member.id}
      type="button"
      onClick={() => onPick(member)}
      className="flex w-full items-center gap-2.5 rounded-xl px-2 py-1.5 text-start hover:bg-[#f4f6f8]"
    >
      <PresenceAvatar member={member} online={online.has(member.id)} ring="ring-popover" size="sm" />
      <span className="min-w-0 text-[13px] leading-tight">
        <span className="block truncate">{member.displayName}</span>
        <span className="block text-[11px] font-light text-muted-foreground">
          {isRoshChevra(member) ? "ראש החברה" : "שיחה אישית"}
        </span>
      </span>
    </button>
  );

  return (
    <div className="space-y-1">
      <div className="px-1.5 pb-1 pt-0.5 text-[14px] font-normal">שיחה חדשה</div>
      <label className="flex items-center gap-2 rounded-xl border border-[#e3e7ec] bg-white px-3 py-1.5">
        <Search className="size-3.5 shrink-0 text-muted-foreground/70" aria-hidden />
        <input
          autoFocus
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="חיפוש חבר…"
          className="min-w-0 flex-1 bg-transparent text-[13px] outline-none placeholder:text-muted-foreground/70"
        />
      </label>
      <div className="max-h-[min(22rem,60vh)] overflow-y-auto">
        {on.length ? (
          <>
            <div className="px-2 pb-0.5 pt-2 text-[11px] font-light text-muted-foreground">מחוברים עכשיו</div>
            {on.map(item)}
          </>
        ) : null}
        {off.length ? (
          <>
            <div className="px-2 pb-0.5 pt-2 text-[11px] font-light text-muted-foreground">
              {on.length ? "כל השאר" : "כל החברים"}
            </div>
            {off.map(item)}
          </>
        ) : null}
        {!list.length ? (
          <p className="px-2 py-4 text-center text-[12px] font-light text-muted-foreground">לא נמצא חבר</p>
        ) : null}
      </div>
    </div>
  );
}
