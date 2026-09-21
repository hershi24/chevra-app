"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from "react";
import { useRouter } from "next/navigation";
import type { ActionBody } from "@/lib/actions";
import type { Member, PublicState } from "@/lib/types";

type AppContextValue = {
  state: PublicState | null;
  loading: boolean;
  error: string | null;
  me: Member | null;
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
    setState(data);
    setError(null);
  }, [router]);

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
    es.onmessage = () => {
      void refresh();
    };
    return () => es.close();
  }, [refresh]);

  const act = useCallback(async (body: ActionBody) => {
    const res = await fetch("/api/actions", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || "הפעולה נכשלה");
    setState(data as PublicState);
    return data as PublicState;
  }, []);

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
      refresh,
      act,
      logout,
    }),
    [state, loading, error, refresh, act, logout]
  );

  return <AppContext.Provider value={value}>{children}</AppContext.Provider>;
}

export function useApp() {
  const ctx = useContext(AppContext);
  if (!ctx) throw new Error("useApp must be used within AppProvider");
  return ctx;
}
