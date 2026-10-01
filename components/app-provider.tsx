"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { useRouter } from "next/navigation";
import { ChatAlerts } from "@/components/chat-alerts";
import type { ActionBody } from "@/lib/actions";
import {
  applyReaction,
  messageFromRow,
  removeMessage,
  toggleReaction,
  upsertMessage,
  type MessageRow,
  type ReactionRow,
} from "@/lib/chat-message";
import { getBrowserSupabase } from "@/lib/supabase-browser";
import type { Member, Message, PublicState, RsvpStatus } from "@/lib/types";

type AppContextValue = {
  state: PublicState | null;
  loading: boolean;
  error: string | null;
  me: Member | null;
  onlineIds: string[];
  refresh: () => Promise<void>;
  act: (body: ActionBody) => Promise<PublicState>;
  logout: () => Promise<void>;
};

const AppContext = createContext<AppContextValue | null>(null);

type PendingRsvp = {
  eventId: string;
  memberId: string;
  status: RsvpStatus;
  ticket: number;
  revision: number;
};

function withPendingRsvps(
  data: PublicState,
  pending: Map<string, PendingRsvp>,
  ticket: number
): PublicState {
  if (pending.size === 0) return data;
  let changed = false;
  const gatherings = data.gatherings.map((item) => {
    const wait = pending.get(item.id);
    if (!wait || wait.ticket !== ticket) return item;
    if (data.revision > wait.revision && item.rsvps[wait.memberId] === wait.status) {
      pending.delete(item.id);
      return item;
    }
    if (item.rsvps[wait.memberId] === wait.status) return item;
    changed = true;
    return { ...item, rsvps: { ...item.rsvps, [wait.memberId]: wait.status } };
  });
  return changed ? { ...data, gatherings } : data;
}

export function AppProvider({
  children,
  initial = null,
}: {
  children: React.ReactNode;
  initial?: PublicState | null;
}) {
  const router = useRouter();
  const [state, setState] = useState<PublicState | null>(initial);
  const [loading, setLoading] = useState(!initial);
  const [error, setError] = useState<string | null>(null);
  const [onlineIds, setOnlineIds] = useState<string[]>([]);
  const pendingIds = useRef(new Set<string>());
  const stateRef = useRef(state);
  const rsvpTicket = useRef(0);
  const pendingRsvps = useRef(new Map<string, PendingRsvp>());
  const seenRevision = useRef(initial?.revision ?? 0);
  useEffect(() => {
    stateRef.current = state;
  }, [state]);

  const applyServerState = useCallback((data: PublicState, prev: PublicState | null) => {
    if (prev && data.revision < seenRevision.current) return prev;
    if (data.revision >= seenRevision.current) seenRevision.current = data.revision;
    const serverIds = new Set(data.messages.map((message) => message.id));
    for (const id of pendingIds.current) {
      if (serverIds.has(id)) pendingIds.current.delete(id);
    }
    const extras = (prev?.messages ?? []).filter(
      (message) => pendingIds.current.has(message.id) && !serverIds.has(message.id)
    );
    const merged = extras.length ? { ...data, messages: [...data.messages, ...extras] } : data;
    return withPendingRsvps(merged, pendingRsvps.current, rsvpTicket.current);
  }, []);

  const refresh = useCallback(async () => {
    const res = await fetch("/api/state", { cache: "no-store" });
    if (res.status === 401) {
      router.replace("/login");
      return;
    }
    if (!res.ok) {
      setError("לא הצלחנו לטעון את החבורה");
      return;
    }
    const data = (await res.json()) as PublicState;
    setState((prev) => applyServerState(data, prev));
    setError(null);
  }, [router, applyServerState]);

  useEffect(() => {
    if (initial) return;
    let cancelled = false;
    fetch("/api/state", { cache: "no-store" })
      .then(async (res) => {
        if (cancelled) return;
        if (res.status === 401) {
          router.replace("/login");
          return;
        }
        if (!res.ok) {
          setError("לא הצלחנו לטעון את החבורה");
          return;
        }
        setState((await res.json()) as PublicState);
        setError(null);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [router, initial]);

  useEffect(() => {
    const es = new EventSource("/api/stream");
    es.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data) as {
          type?: string;
          ids?: string[];
          message?: Message;
          messageId?: string;
        };
        if ((data.type === "presence" || data.type === "hello") && Array.isArray(data.ids)) {
          setOnlineIds(data.ids);
          return;
        }
        if (data.type === "typing" || data.type === "seen") {
          window.dispatchEvent(new CustomEvent(`chevra-${data.type}`, { detail: data }));
          return;
        }
        if (data.type === "message" && data.message) {
          const incoming = data.message;
          setState((prev) => {
            if (!prev || !prev.channels.some((channel) => channel.id === incoming.channelId)) return prev;
            if (!prev.messages.some((message) => message.id === incoming.id)) {
              pendingIds.current.add(incoming.id);
            }
            return { ...prev, messages: upsertMessage(prev.messages, incoming) };
          });
          return;
        }
        if (data.type === "message-removed" && data.messageId) {
          const gone = data.messageId;
          pendingIds.current.delete(gone);
          setState((prev) => (prev ? { ...prev, messages: removeMessage(prev.messages, gone) } : prev));
          return;
        }
      } catch {
        // keep refreshing on malformed payloads
      }
      void refresh();
    };
    return () => es.close();
  }, [refresh]);

  useEffect(() => {
    const supabase = getBrowserSupabase();
    if (!supabase) return;

    const channel = supabase
      .channel("chevra-live-chat")
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "messages" },
        (payload) => {
          const incoming = messageFromRow(payload.new as MessageRow);
          setState((prev) => {
            if (!prev) return prev;
            if (!prev.channels.some((channel) => channel.id === incoming.channelId)) return prev;
            return { ...prev, messages: upsertMessage(prev.messages, incoming) };
          });
        }
      )
      .on(
        "postgres_changes",
        { event: "DELETE", schema: "public", table: "messages" },
        (payload) => {
          const old = payload.old as { id?: string };
          if (!old?.id) return;
          setState((prev) => {
            if (!prev) return prev;
            return { ...prev, messages: removeMessage(prev.messages, old.id!) };
          });
        }
      )
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "message_reactions" },
        (payload) => {
          const row = (payload.new ?? payload.old) as ReactionRow;
          if (!row?.message_id) return;
          const action = payload.eventType as "INSERT" | "UPDATE" | "DELETE";
          setState((prev) => {
            if (!prev) return prev;
            return { ...prev, messages: applyReaction(prev.messages, row, action) };
          });
        }
      )
      .subscribe();

    return () => {
      void supabase.removeChannel(channel);
    };
  }, []);

  const act = useCallback(async (body: ActionBody) => {
    let staged: Message | null = null;
    let reaction: { messageId: string; emoji: string } | null = null;
    let undoRsvp: { eventId: string; memberId: string; status?: RsvpStatus } | null = null;
    let ticket = 0;
    if (body.type === "sendMessage") {
      const id = body.id && body.id.length > 0 ? body.id : crypto.randomUUID();
      body = { ...body, id };
      staged = {
        id,
        channelId: body.channelId,
        authorId: "",
        text: body.text.trim(),
        createdAt: new Date().toISOString(),
        quote: body.quote,
        reactions: {},
        attachments: body.attachments ?? [],
        voiceUrl: body.voiceUrl,
        mentions: body.mentions ?? [],
      };
      pendingIds.current.add(id);
      setState((prev) => {
        if (!prev?.me || prev.messages.some((message) => message.id === id)) return prev;
        return { ...prev, messages: [...prev.messages, { ...staged!, authorId: prev.me.id }] };
      });
    } else if (body.type === "react") {
      const { messageId, emoji } = body;
      reaction = { messageId, emoji };
      setState((prev) => {
        if (!prev?.me) return prev;
        return {
          ...prev,
          messages: toggleReaction(prev.messages, messageId, emoji, prev.me.id),
        };
      });
    } else if (body.type === "rsvp") {
      const current = stateRef.current;
      const memberId = current?.me.id;
      if (current && memberId) {
        ticket = ++rsvpTicket.current;
        const eventId = body.eventId;
        const status = body.status;
        undoRsvp = {
          eventId,
          memberId,
          status: current.gatherings.find((item) => item.id === eventId)?.rsvps[memberId],
        };
        pendingRsvps.current.set(eventId, {
          eventId,
          memberId,
          status,
          ticket,
          revision: current.revision,
        });
        setState((prev) =>
          prev
            ? {
                ...prev,
                gatherings: prev.gatherings.map((item) =>
                  item.id === eventId ? { ...item, rsvps: { ...item.rsvps, [memberId]: status } } : item
                ),
              }
            : prev
        );
      }
    }
    try {
      const res = await fetch("/api/actions", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const data = (await res.json()) as PublicState & { error?: string };
      if (!res.ok) throw new Error(data.error || "הפעולה נכשלה");
      if (body.type !== "rsvp" || ticket === rsvpTicket.current) {
        setState((prev) => applyServerState(data, prev));
      }
      return data;
    } catch (error) {
      if (staged) {
        pendingIds.current.delete(staged.id);
        setState((prev) =>
          prev ? { ...prev, messages: prev.messages.filter((message) => message.id !== staged.id) } : prev
        );
      } else if (reaction) {
        const undo = reaction;
        setState((prev) => {
          if (!prev?.me) return prev;
          return {
            ...prev,
            messages: toggleReaction(prev.messages, undo.messageId, undo.emoji, prev.me.id),
          };
        });
      } else if (undoRsvp && ticket === rsvpTicket.current) {
        const undo = undoRsvp;
        pendingRsvps.current.delete(undo.eventId);
        setState((prev) => {
          if (!prev) return prev;
          return {
            ...prev,
            gatherings: prev.gatherings.map((item) => {
              if (item.id !== undo.eventId) return item;
              const rsvps = { ...item.rsvps };
              if (undo.status === undefined) delete rsvps[undo.memberId];
              else rsvps[undo.memberId] = undo.status;
              return { ...item, rsvps };
            }),
          };
        });
      }
      throw error;
    }
  }, [applyServerState]);

  const logout = useCallback(async () => {
    await fetch("/api/auth", { method: "DELETE" });
    router.replace("/login");
    router.refresh();
  }, [router]);

  const value = useMemo(
    () => ({
      state,
      loading,
      error,
      me: state?.me ?? null,
      onlineIds,
      refresh,
      act,
      logout,
    }),
    [state, loading, error, onlineIds, refresh, act, logout]
  );

  return (
    <AppContext.Provider value={value}>
      <ChatAlerts state={state} />
      {children}
    </AppContext.Provider>
  );
}

export function useApp() {
  const ctx = useContext(AppContext);
  if (!ctx) throw new Error("useApp must be used within AppProvider");
  return ctx;
}
