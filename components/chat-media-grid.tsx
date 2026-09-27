"use client";

import { useState } from "react";
import { Play } from "lucide-react";
import type { Attachment } from "@/lib/types";
import { cn } from "@/lib/utils";

const MIN_RATIO = 3 / 4;
const MAX_RATIO = 4 / 3;

export type VisualAttachment = Attachment & { type: "image" | "video" };

export function isVisualAttachment(file: Attachment): file is VisualAttachment {
  return file.type === "image" || file.type === "video";
}

function formatDuration(seconds: number) {
  const total = Math.max(0, Math.round(seconds));
  return `${Math.floor(total / 60)}:${String(total % 60).padStart(2, "0")}`;
}

export function ChatMediaGrid({
  items,
  onOpen,
  className,
}: {
  items: VisualAttachment[];
  onOpen: (item: VisualAttachment) => void;
  className?: string;
}) {
  if (items.length === 1) {
    return <SingleMedia item={items[0]} onOpen={onOpen} className={className} />;
  }
  const odd = items.length % 2 === 1;
  return (
    <div className={cn("grid w-[17rem] max-w-full grid-cols-2 gap-1", className)}>
      {items.map((item, index) => (
        <MediaTile
          key={item.id}
          item={item}
          onOpen={onOpen}
          className={cn(
            "rounded-xl",
            odd && index === 0 ? "col-span-2 aspect-[2/1]" : "aspect-square"
          )}
        />
      ))}
    </div>
  );
}

function SingleMedia({
  item,
  onOpen,
  className,
}: {
  item: VisualAttachment;
  onOpen: (item: VisualAttachment) => void;
  className?: string;
}) {
  const [ratio, setRatio] = useState(1);
  return (
    <MediaTile
      item={item}
      onOpen={onOpen}
      onRatio={(value) => setRatio(Math.min(MAX_RATIO, Math.max(MIN_RATIO, value)))}
      style={{ aspectRatio: ratio }}
      className={cn("w-[17rem] max-w-full rounded-2xl", className)}
    />
  );
}

function MediaTile({
  item,
  onOpen,
  onRatio,
  className,
  style,
}: {
  item: VisualAttachment;
  onOpen: (item: VisualAttachment) => void;
  onRatio?: (ratio: number) => void;
  className?: string;
  style?: React.CSSProperties;
}) {
  const [duration, setDuration] = useState<number | null>(null);
  return (
    <button
      type="button"
      aria-label={item.type === "video" ? "הפעלת סרטון" : "הגדלת תמונה"}
      style={style}
      onClick={(event) => {
        event.stopPropagation();
        onOpen(item);
      }}
      className={cn(
        "relative block cursor-zoom-in overflow-hidden bg-[#e8eaed] outline-none focus-visible:ring-2 focus-visible:ring-[#0b57d0]",
        className
      )}
    >
      {item.type === "video" ? (
        <>
          <video
            src={item.url.includes("#") ? item.url : `${item.url}#t=0.1`}
            muted
            playsInline
            preload="metadata"
            className="pointer-events-none size-full object-cover"
            onLoadedMetadata={(event) => {
              const video = event.currentTarget;
              if (video.videoWidth && video.videoHeight) onRatio?.(video.videoWidth / video.videoHeight);
              if (Number.isFinite(video.duration)) setDuration(video.duration);
            }}
          />
          <span className="absolute inset-0 flex items-center justify-center">
            <span className="flex size-10 items-center justify-center rounded-full bg-black/45 text-white">
              <Play className="size-5 translate-x-px fill-current" />
            </span>
          </span>
          {duration != null ? (
            <span
              dir="ltr"
              className="absolute bottom-1.5 left-1.5 rounded-full bg-black/50 px-1.5 text-[11px] leading-4 text-white tabular-nums"
            >
              {formatDuration(duration)}
            </span>
          ) : null}
        </>
      ) : (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={item.url}
          alt={item.name}
          className="size-full object-cover"
          onLoad={(event) => {
            const image = event.currentTarget;
            if (image.naturalWidth && image.naturalHeight) onRatio?.(image.naturalWidth / image.naturalHeight);
          }}
        />
      )}
    </button>
  );
}
