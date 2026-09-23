"use client";

import { useRef } from "react";
import { cn } from "@/lib/utils";

const MOBILE = "(max-width: 767px)";
const HOLD_MS = 480;
const MOVE_PX = 12;

function isMobileView() {
  return window.matchMedia(MOBILE).matches;
}

export function ChatBubble({
  canDelete,
  onLongPress,
  className,
  children,
}: {
  canDelete: boolean;
  onLongPress: () => void;
  className?: string;
  children: React.ReactNode;
}) {
  const timer = useRef<number | null>(null);
  const origin = useRef<{ x: number; y: number } | null>(null);

  function clearTimer() {
    if (timer.current != null) {
      window.clearTimeout(timer.current);
      timer.current = null;
    }
    origin.current = null;
  }

  function enabled() {
    return canDelete && isMobileView();
  }

  return (
    <div
      className={cn(
        className,
        canDelete && "touch-manipulation select-none [-webkit-touch-callout:none] md:select-text"
      )}
      onPointerDown={(event) => {
        if (!enabled()) return;
        if (event.pointerType === "mouse" && event.button !== 0) return;
        origin.current = { x: event.clientX, y: event.clientY };
        event.currentTarget.setPointerCapture(event.pointerId);
        timer.current = window.setTimeout(() => {
          timer.current = null;
          origin.current = null;
          try {
            navigator.vibrate?.(12);
          } catch {
            /* ignore */
          }
          onLongPress();
        }, HOLD_MS);
      }}
      onPointerMove={(event) => {
        if (!origin.current) return;
        if (
          Math.hypot(event.clientX - origin.current.x, event.clientY - origin.current.y) > MOVE_PX
        ) {
          clearTimer();
        }
      }}
      onPointerUp={clearTimer}
      onPointerCancel={clearTimer}
      onContextMenu={(event) => {
        if (!enabled()) return;
        event.preventDefault();
        clearTimer();
        onLongPress();
      }}
    >
      {children}
    </div>
  );
}
