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
import type { Member, Message, PublicState } from "@/lib/types";

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

export function AppProvider({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const [state, setState] = useState<PublicState | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [onlineIds, setOnlineIds] = useState<string[]>([]);
  const pendingIds = useRef(new Set<string>());

  const applyServerState = useCallback((data: PublicState, prev: PublicState | null) => {
    const serverIds = new Set(data.messages.map((message) => message.id));
    for (const id of pendingIds.current) {
      if (serverIds.has(id)) pendingIds.current.delete(id);
    }
    const extras = (prev?.messages ?? []).filter(
      (message) => pendingIds.current.has(message.id) && !serverIds.has(message.id)
    );
    return extras.length ? { ...data, messages: [...data.messages, ...extras] } : data;
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
  }, [router]);

  useEffect(() => {
    const es = new EventSource("/api/stream");
    es.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data) as { type?: string; ids?: string[] };
        if ((data.type === "presence" || data.type === "hello") && Array.isArray(data.ids)) {
          setOnlineIds(data.ids);
          if (data.type === "presence") return;
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
    }
    try {
      const res = await fetch("/api/actions", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const data = (await res.json()) as PublicState & { error?: string };
      if (!res.ok) throw new Error(data.error || "הפעולה נכשלה");
      setState((prev) => applyServerState(data, prev));
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

  return <AppContext.Provider value={value}>{children}</AppContext.Provider>;
}

export function useApp() {
  const ctx = useContext(AppContext);
  if (!ctx) throw new Error("useApp must be used within AppProvider");
  return ctx;
}
