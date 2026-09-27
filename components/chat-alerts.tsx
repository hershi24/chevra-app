"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import {
  enableNotifications,
  ensurePushSubscription,
  notificationsEnabled,
  setNotificationsEnabled,
  showChatNotification,
} from "@/lib/chat-notify";
import { cn } from "@/lib/utils";
import type { PublicState } from "@/lib/types";

export function ChatAlerts({ state }: { state: PublicState | null }) {
  const router = useRouter();
  const seen = useRef<Set<string> | null>(null);

  useEffect(() => {
    void ensurePushSubscription();
    const retry = () => {
      void ensurePushSubscription();
    };
    window.addEventListener("pointerdown", retry, { once: true });
    return () => window.removeEventListener("pointerdown", retry);
  }, []);

  useEffect(() => {
    if (!("serviceWorker" in navigator)) return;
    const onMessage = (event: MessageEvent) => {
      const data = event.data as { type?: string; url?: string; messageId?: string } | null;
      if (!data || data.type !== "open-chat" || !data.url) return;
      if (data.messageId) {
        sessionStorage.setItem("chevra-reply", data.messageId);
        window.dispatchEvent(new CustomEvent("chevra-open-reply", { detail: data.messageId }));
      }
      router.push(data.url);
    };
    navigator.serviceWorker.addEventListener("message", onMessage);
    return () => navigator.serviceWorker.removeEventListener("message", onMessage);
  }, [router]);

  useEffect(() => {
    if (!state) return;
    if (!seen.current) {
      seen.current = new Set(state.messages.map((message) => message.id));
      return;
    }
    const fresh: { title: string; body: string; channelId: string; id: string }[] = [];
    for (const message of state.messages) {
      if (seen.current.has(message.id)) continue;
      seen.current.add(message.id);
      if (message.authorId === state.me.id) continue;
      const age = Date.now() - Date.parse(message.createdAt);
      if (!Number.isFinite(age) || age > 60_000) continue;
      const author = state.members.find((member) => member.id === message.authorId);
      fresh.push({
        id: message.id,
        channelId: message.channelId,
        title: author?.displayName || "הודעה חדשה",
        body:
          message.text.trim() ||
          message.poll?.question ||
          (message.voiceUrl ? "הודעה קולית" : message.attachments.length ? "קובץ מצורף" : "הודעה חדשה"),
      });
    }
    const latest = fresh.at(-1);
    if (!latest) return;
    if (document.visibilityState === "visible") {
      toast(latest.title, {
        id: "chevra-incoming",
        description: latest.body,
        duration: 2500,
        action: {
          label: "השב",
          onClick: () => {
            sessionStorage.setItem("chevra-reply", latest.id);
            window.dispatchEvent(new CustomEvent("chevra-open-reply", { detail: latest.id }));
            router.push(`/chat/${latest.channelId}`);
          },
        },
      });
      return;
    }
    void showChatNotification({
      title: latest.title,
      body: latest.body,
      channelId: latest.channelId,
      messageId: latest.id,
    });
  }, [state, router]);

  return null;
}

export function NotificationToggle() {
  const [on, setOn] = useState(false);

  useEffect(() => {
    const sync = () => setOn(notificationsEnabled());
    sync();
    window.addEventListener("chevra-notify", sync);
    return () => window.removeEventListener("chevra-notify", sync);
  }, []);

  return (
    <button
      type="button"
      className="ms-auto flex shrink-0 items-center gap-1.5 text-[12px] text-[#3f4650]"
      aria-pressed={on}
      onClick={() => {
        if (on) {
          setNotificationsEnabled(false);
          return;
        }
        void enableNotifications().then((ok) => {
          if (!ok) toast.error("הדפדפן לא אישר התראות");
          else toast.success("התראות דלוקות", { id: "chevra-incoming", duration: 2000 });
        });
      }}
    >
      התראות
      <span className={cn("relative inline-block h-5 w-[34px] rounded-full", on ? "bg-[#a9782c]" : "bg-black/15")}>
        <span
          className={cn(
            "absolute top-0.5 size-4 rounded-full bg-white",
            on ? "left-0.5" : "right-0.5"
          )}
        />
      </span>
    </button>
  );
}
