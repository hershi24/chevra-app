"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { Pause, Play } from "lucide-react";
import { cn } from "@/lib/utils";

const BAR_COUNT = 48;
let activeAudio: HTMLAudioElement | null = null;

function waveformFromSrc(src: string) {
  let seed = 2166136261;
  for (let i = 0; i < src.length; i++) {
    seed ^= src.charCodeAt(i);
    seed = Math.imul(seed, 16777619);
  }
  const bars: number[] = [];
  for (let i = 0; i < BAR_COUNT; i++) {
    seed = Math.imul(seed ^ (seed >>> 16), 2246822519);
    const noise = ((seed >>> 0) % 1000) / 1000;
    const envelope = Math.sin((i / (BAR_COUNT - 1)) * Math.PI);
    bars.push(0.16 + envelope * (0.22 + noise * 0.62));
  }
  return bars;
}

function formatClock(seconds: number) {
  if (!Number.isFinite(seconds) || seconds < 0) return "0:00";
  const whole = Math.floor(seconds);
  const m = Math.floor(whole / 60);
  const s = whole % 60;
  return `${m}:${s.toString().padStart(2, "0")}`;
}

export function VoiceNotePlayer({
  src,
  className,
  onReady,
}: {
  src: string;
  className?: string;
  onReady?: () => void;
}) {
  const audioRef = useRef<HTMLAudioElement>(null);
  const [playing, setPlaying] = useState(false);
  const [current, setCurrent] = useState(0);
  const [duration, setDuration] = useState(0);
  const bars = useMemo(() => waveformFromSrc(src), [src]);
  const progress = duration > 0 ? current / duration : 0;

  useEffect(() => {
    const audio = audioRef.current;
    if (!audio) return;
    const onTime = () => setCurrent(audio.currentTime);
    const onMeta = () => {
      setDuration(audio.duration || 0);
      onReady?.();
    };
    const onEnd = () => {
      setPlaying(false);
      setCurrent(0);
      if (activeAudio === audio) activeAudio = null;
    };
    const onPause = () => {
      if (activeAudio === audio) setPlaying(false);
    };
    audio.addEventListener("timeupdate", onTime);
    audio.addEventListener("loadedmetadata", onMeta);
    audio.addEventListener("ended", onEnd);
    audio.addEventListener("pause", onPause);
    return () => {
      audio.removeEventListener("timeupdate", onTime);
      audio.removeEventListener("loadedmetadata", onMeta);
      audio.removeEventListener("ended", onEnd);
      audio.removeEventListener("pause", onPause);
      if (activeAudio === audio) {
        audio.pause();
        activeAudio = null;
      }
    };
  }, [src, onReady]);

  function toggle() {
    const audio = audioRef.current;
    if (!audio) return;
    if (playing) {
      audio.pause();
      setPlaying(false);
      if (activeAudio === audio) activeAudio = null;
      return;
    }
    if (activeAudio && activeAudio !== audio) activeAudio.pause();
    void audio.play().then(() => {
      activeAudio = audio;
      setPlaying(true);
    });
  }

  function seek(index: number) {
    const audio = audioRef.current;
    if (!audio || !duration) return;
    audio.currentTime = (index / (BAR_COUNT - 1)) * duration;
    setCurrent(audio.currentTime);
  }

  return (
    <div
      dir="ltr"
      className={cn(
        "flex h-10 w-full max-w-[20rem] items-center gap-2.5 rounded-full bg-white px-3.5 ring-1 ring-[#c5d4f5]",
        className
      )}
    >
      <audio ref={audioRef} src={src} preload="metadata" className="hidden" />
      <span className="w-8 shrink-0 text-[13px] font-normal tabular-nums text-[#4b5563]">
        {formatClock(playing || current > 0 ? current : duration)}
      </span>
      <div className="flex h-5 min-w-0 flex-1 items-center justify-between gap-px" aria-hidden>
        {bars.map((height, index) => {
          const reached = index / (BAR_COUNT - 1) <= progress;
          return (
            <button
              key={index}
              type="button"
              tabIndex={-1}
              onClick={() => seek(index)}
              className="flex h-full flex-1 items-center justify-center"
            >
              <span
                className={cn(
                  "block w-[2px] max-w-full rounded-full",
                  reached && (playing || current > 0) ? "bg-[#3f4650]" : "bg-[#5b6570]"
                )}
                style={{ height: `${Math.round(height * 100)}%` }}
              />
            </button>
          );
        })}
      </div>
      <button
        type="button"
        onClick={toggle}
        aria-label={playing ? "השהה" : "נגן"}
        className="flex size-7 shrink-0 items-center justify-center text-[#3f4650]"
      >
        {playing ? (
          <Pause className="size-4 fill-current" />
        ) : (
          <Play className="size-4 fill-current" />
        )}
      </button>
    </div>
  );
}
