"use client";

import { useEffect, useRef, useState } from "react";
import { UserAvatar } from "@/components/user-avatar";
import type { Channel, Member } from "@/lib/types";

const PING_EVERY_MS = 3000;
const TYPING_TTL_MS = 6000;

type TypingEvent = { channelId?: string; memberId?: string; typing?: boolean };
type SeenEvent = { channelId?: string; memberId?: string; at?: string };

function postTyping(channelId: string, typing: boolean) {
  void fetch("/api/chat/typing", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ channelId, typing }),
    keepalive: !typing,
  }).catch(() => undefined);
}

/** Tells the others in the room while I have something written in the composer. */
export function useTypingSignal(channelId: string | null, draft: string) {
  const lastPing = useRef(0);
  const hasText = draft.trim().length > 0;

  useEffect(() => {
    if (!channelId) return;
    if (!hasText) {
      if (lastPing.current) {
        lastPing.current = 0;
        postTyping(channelId, false);
      }
      return;
    }
    const now = Date.now();
    if (now - lastPing.current >= PING_EVERY_MS) {
      lastPing.current = now;
      postTyping(channelId, true);
    }
  }, [channelId, draft, hasText]);

  useEffect(() => {
    if (!channelId) return;
    return () => {
      if (lastPing.current) {
        lastPing.current = 0;
        postTyping(channelId, false);
      }
    };
  }, [channelId]);
}

/** Members currently typing in the given room, oldest first. */
export function useTypers(channelId: string | null, myId: string | undefined) {
  const [typing, setTyping] = useState<Record<string, Record<string, number>>>({});

  useEffect(() => {
    const onTyping = (event: Event) => {
      const data = (event as CustomEvent<TypingEvent>).detail;
      const room = data?.channelId;
      const who = data?.memberId;
      if (!room || !who || who === myId) return;
      setTyping((prev) => {
        const current = { ...(prev[room] ?? {}) };
        if (data.typing === false) delete current[who];
        else current[who] = Date.now() + TYPING_TTL_MS;
        return { ...prev, [room]: current };
      });
    };
    window.addEventListener("chevra-typing", onTyping);
    const timer = window.setInterval(() => {
      const now = Date.now();
      setTyping((prev) => {
        let changed = false;
        const next: Record<string, Record<string, number>> = {};
        for (const [room, members] of Object.entries(prev)) {
          const kept = Object.fromEntries(Object.entries(members).filter(([, until]) => until > now));
          if (Object.keys(kept).length !== Object.keys(members).length) changed = true;
          next[room] = kept;
        }
        return changed ? next : prev;
      });
    }, 1000);
    return () => {
      window.removeEventListener("chevra-typing", onTyping);
      window.clearInterval(timer);
    };
  }, [myId]);

  return channelId ? Object.keys(typing[channelId] ?? {}) : [];
}

/** When each other member of a private chat last had it open. */
export function useDmSeen(channel: Channel | null) {
  const dmId = channel?.type === "dm" ? channel.id : null;
  const [seen, setSeen] = useState<{ channelId: string; at: Record<string, string> } | null>(null);

  useEffect(() => {
    if (!dmId) return;
    let cancelled = false;
    fetch(`/api/chat/seen?channelId=${encodeURIComponent(dmId)}`, { cache: "no-store" })
      .then((res) => (res.ok ? res.json() : null))
      .then((data: { seen?: Record<string, string> } | null) => {
        if (cancelled || !data?.seen) return;
        setSeen((prev) => ({
          channelId: dmId,
          at: { ...(prev?.channelId === dmId ? prev.at : {}), ...data.seen },
        }));
      })
      .catch(() => undefined);
    const onSeen = (event: Event) => {
      const data = (event as CustomEvent<SeenEvent>).detail;
      if (data?.channelId !== dmId || !data.memberId || !data.at) return;
      const { memberId, at } = data;
      setSeen((prev) => ({
        channelId: dmId,
        at: { ...(prev?.channelId === dmId ? prev.at : {}), [memberId]: at },
      }));
    };
    window.addEventListener("chevra-seen", onSeen);
    return () => {
      cancelled = true;
      window.removeEventListener("chevra-seen", onSeen);
    };
  }, [dmId]);

  return dmId && seen?.channelId === dmId ? seen.at : {};
}

function firstName(member: Member | undefined) {
  return member?.displayName.trim().split(/\s+/)[0] ?? "";
}

function typingLabel(members: Member[]) {
  const names = members.map(firstName);
  if (names.length === 1) return `${names[0]} מקליד…`;
  if (names.length === 2) return `${names[0]} ו${names[1]} מקלידים…`;
  return `${names[0]} ועוד ${names.length - 1} מקלידים…`;
}

export function TypingIndicator({ members }: { members: Member[] }) {
  if (!members.length) return null;
  return (
    <div className="flex items-center gap-2" aria-live="polite">
      <UserAvatar member={members[0]} size="sm" />
      <div className="flex h-8 items-center gap-1 rounded-[18px] bg-[#f1f3f4] px-3">
        {[0, 1, 2].map((dot) => (
          <span
            key={dot}
            className="chat-typing-dot size-1.5 rounded-full bg-[#5f6368]"
            style={{ animationDelay: `${dot * 0.16}s` }}
          />
        ))}
      </div>
      <span className="text-xs text-[#5f6368]">{typingLabel(members)}</span>
    </div>
  );
}

export function SeenAvatar({ member }: { member: Member | undefined }) {
  if (!member) return null;
  return (
    <span
      className="pointer-events-none absolute -right-[7px] -bottom-[5px] z-10"
      title={`${member.displayName} קרא`}
      aria-label={`${member.displayName} קרא`}
    >
      <UserAvatar
        member={member}
        size="sm"
        className="ring-2 ring-white data-[size=sm]:size-4 [&_[data-slot=avatar-fallback]]:!text-[7px]"
      />
    </span>
  );
}
