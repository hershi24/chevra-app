import { Music } from "lucide-react";
import { cn } from "@/lib/utils";

export function formatUploadRemaining(seconds: number | null | undefined) {
  if (seconds == null) return "מעלה…";
  if (seconds <= 0) return "כמעט מוכן";
  if (seconds < 8) return "עוד כמה שניות";
  if (seconds < 60) return `עוד כ־${seconds} שנ׳`;
  const minutes = Math.max(1, Math.round(seconds / 60));
  if (minutes === 1) return "עוד כ־דקה";
  return `עוד כ־${minutes} דק׳`;
}

export function MediaProgressOverlay({
  src,
  type,
  progress,
  remainingSeconds,
  className,
  mediaClassName,
  name,
  onReady,
}: {
  src: string;
  type: "image" | "video" | "audio" | "file";
  progress: number;
  remainingSeconds?: number | null;
  className?: string;
  mediaClassName?: string;
  name?: string;
  onReady?: () => void;
}) {
  return (
    <div
      data-upload-progress=""
      className={cn("relative min-h-40 overflow-hidden bg-black/90", className)}
    >
      {type === "video" ? (
        <video
          src={src}
          muted
          playsInline
          preload="metadata"
          onLoadedMetadata={onReady}
          className={cn("max-h-[420px] w-full bg-black object-cover", mediaClassName)}
        />
      ) : type === "image" ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={src}
          alt=""
          onLoad={onReady}
          className={cn("max-h-[420px] w-full object-cover", mediaClassName)}
        />
      ) : type === "audio" ? (
        <div className="flex min-h-40 flex-col justify-end bg-neutral-800 px-4 pb-4 pt-12">
          <div className="mb-3 flex items-center gap-2 text-sm text-white/85">
            <Music className="size-5 shrink-0" />
            <span className="truncate">{name || "הקלטה"}</span>
          </div>
          <audio
            src={src}
            controls
            preload="metadata"
            onLoadedMetadata={onReady}
            className="w-full"
          />
        </div>
      ) : (
        <div className="flex h-32 items-center justify-center text-sm text-white/80">מעלה קובץ…</div>
      )}
      <div className="absolute inset-0 flex flex-col items-center justify-center bg-black/50 text-white">
        <div className="text-2xl font-medium tabular-nums">{progress}%</div>
        <div className="mt-2 h-1.5 w-2/3 overflow-hidden rounded-full bg-white/25">
          <div
            className="h-full rounded-full bg-white transition-[width] duration-150"
            style={{ width: `${progress}%` }}
          />
        </div>
        <div className="mt-2 text-[12px] font-light text-white/80">
          {formatUploadRemaining(remainingSeconds)}
        </div>
      </div>
    </div>
  );
}
