"use client";

import { useEffect, useRef } from "react";
import { cn } from "@/lib/utils";

const HOLD_MS = 480;
const MOVE_PX = 12;

function isMobileView() {
  return window.innerWidth < 768 || window.matchMedia("(max-width: 767px)").matches;
}

export function ChatBubble({
  canDelete,
  onLongPress,
  onShortClick,
  className,
  children,
}: {
  canDelete: boolean;
  onLongPress: () => void;
  onShortClick?: () => void;
  className?: string;
  children: React.ReactNode;
}) {
  const rootRef = useRef<HTMLDivElement>(null);
  const onLongPressRef = useRef(onLongPress);
  const canDeleteRef = useRef(canDelete);
  const blockClickRef = useRef(false);
  onLongPressRef.current = onLongPress;
  canDeleteRef.current = canDelete;

  useEffect(() => {
    const node = rootRef.current;
    if (!node) return;

    let timer: number | null = null;
    let origin: { x: number; y: number } | null = null;

    function enabled() {
      return canDeleteRef.current && isMobileView();
    }

    function clearTimer() {
      if (timer != null) {
        window.clearTimeout(timer);
        timer = null;
      }
      origin = null;
    }

    function fire() {
      clearTimer();
      blockClickRef.current = true;
      try {
        navigator.vibrate?.(12);
      } catch {
        /* ignore */
      }
      onLongPressRef.current();
    }

    function onPointerDown(event: PointerEvent) {
      if (!enabled()) return;
      if (event.pointerType === "mouse" && event.button !== 0) return;
      origin = { x: event.clientX, y: event.clientY };
      try {
        (event.currentTarget as HTMLElement).setPointerCapture(event.pointerId);
      } catch {
        /* ignore */
      }
      timer = window.setTimeout(fire, HOLD_MS);
    }

    function onPointerMove(event: PointerEvent) {
      if (!origin) return;
      if (Math.hypot(event.clientX - origin.x, event.clientY - origin.y) > MOVE_PX) {
        clearTimer();
      }
    }

    function onContextMenu(event: Event) {
      if (!enabled()) return;
      event.preventDefault();
      event.stopPropagation();
      fire();
    }

    node.addEventListener("pointerdown", onPointerDown);
    node.addEventListener("pointermove", onPointerMove);
    node.addEventListener("pointerup", clearTimer);
    node.addEventListener("pointercancel", clearTimer);
    node.addEventListener("contextmenu", onContextMenu);
    return () => {
      clearTimer();
      node.removeEventListener("pointerdown", onPointerDown);
      node.removeEventListener("pointermove", onPointerMove);
      node.removeEventListener("pointerup", clearTimer);
      node.removeEventListener("pointercancel", clearTimer);
      node.removeEventListener("contextmenu", onContextMenu);
    };
  }, []);

  return (
    <div
      ref={rootRef}
      data-chat-bubble=""
      data-can-delete={canDelete ? "true" : "false"}
      onClick={(event) => {
        if (blockClickRef.current) {
          blockClickRef.current = false;
          return;
        }
        if (!onShortClick) return;
        const target = event.target as HTMLElement;
        if (target.closest("a, button, video, audio, input, textarea")) return;
        onShortClick();
      }}
      className={cn(
        className,
        onShortClick && "cursor-pointer",
        canDelete && "touch-manipulation select-none [-webkit-touch-callout:none] md:select-text"
      )}
    >
      {children}
    </div>
  );
}
