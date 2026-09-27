"use client";

import { useEffect, useRef, useState } from "react";
import { usePathname, useRouter } from "next/navigation";
import { toast } from "sonner";
import {
  enableNotifications,
  notificationsEnabled,
  setNotificationsEnabled,
  showChatNotification,
} from "@/lib/chat-notify";
import { cn } from "@/lib/utils";
import type { PublicState } from "@/lib/types";

export function ChatAlerts({ state }: { state: PublicState | null }) {
  const pathname = usePathname();
  const router = useRouter();
  const seen = useRef<Set<string> | null>(null);
  const pathRef = useRef(pathname);
  pathRef.current = pathname;

  useEffect(() => {
    if (!("serviceWorker" in navigator)) return;
    const onMessage = (event: MessageEvent) => {
      const data = event.data as { type?: string; url?: string; messageId?: string } | null;
      if (!data || data.type !== "open-chat" || !data.url) return;
      if (data.messageId) sessionStorage.setItem("chevra-reply", data.messageId);
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
    for (const message of state.messages) {
      if (seen.current.has(message.id)) continue;
      seen.current.add(message.id);
      if (message.authorId === state.me.id) continue;
      const here = pathRef.current === `/chat/${message.channelId}` && !document.hidden;
      if (here) continue;
      const author = state.members.find((member) => member.id === message.authorId);
      const body =
        message.text.trim() ||
        message.poll?.question ||
        (message.voiceUrl ? "הודעה קולית" : message.attachments.length ? "קובץ מצורף" : "הודעה חדשה");
      void showChatNotification({
        title: author?.displayName || "הודעה חדשה",
        body,
        channelId: message.channelId,
        messageId: message.id,
      });
    }
  }, [state]);

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
