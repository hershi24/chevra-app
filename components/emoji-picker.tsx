"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { Search, X } from "lucide-react";
import { cn } from "@/lib/utils";
import type { EmojiEntry, EmojiGroup } from "@/lib/emoji-data";

const RECENT_KEY = "chevra-emoji-recent";
const TONE_KEY = "chevra-emoji-tone";
const RECENT_LIMIT = 27;
const FALLBACK_RECENT = ["❤️", "👍", "😂", "🙏", "🔥", "✨", "🎉", "☕", "😊"];
const TONES = ["👋", "👋🏻", "👋🏼", "👋🏽", "👋🏾", "👋🏿"];

let cachedGroups: EmojiGroup[] | null = null;

function readRecent(): string[] {
  try {
    const value = JSON.parse(localStorage.getItem(RECENT_KEY) ?? "[]");
    return Array.isArray(value) && value.length ? value.slice(0, RECENT_LIMIT) : FALLBACK_RECENT;
  } catch {
    return FALLBACK_RECENT;
  }
}

function readTone() {
  const value = Number(typeof window === "undefined" ? 0 : localStorage.getItem(TONE_KEY));
  return Number.isInteger(value) && value >= 0 && value <= 5 ? value : 0;
}

function withTone(entry: EmojiEntry, tone: number) {
  return tone && entry[3] ? entry[3][tone - 1] : entry[0];
}

export function EmojiPicker({
  onPick,
  className,
}: {
  onPick: (emoji: string) => void;
  className?: string;
}) {
  const [groups, setGroups] = useState<EmojiGroup[] | null>(cachedGroups);
  const [query, setQuery] = useState("");
  const [recent, setRecent] = useState<string[]>(readRecent);
  const [tone, setTone] = useState(readTone);
  const [activeTab, setActiveTab] = useState("recent");
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (cachedGroups) return;
    let alive = true;
    void import("@/lib/emoji-data").then((module) => {
      cachedGroups = module.EMOJI_GROUPS;
      if (alive) setGroups(module.EMOJI_GROUPS);
    });
    return () => {
      alive = false;
    };
  }, []);

  const results = useMemo(() => {
    const term = query.trim().toLowerCase();
    if (!term || !groups) return null;
    return groups
      .flatMap((group) => group.emojis)
      .filter((entry) => entry[1].includes(term) || entry[2].includes(term));
  }, [groups, query]);

  function pick(emoji: string) {
    const next = [emoji, ...recent.filter((item) => item !== emoji)].slice(0, RECENT_LIMIT);
    setRecent(next);
    localStorage.setItem(RECENT_KEY, JSON.stringify(next));
    onPick(emoji);
  }

  function chooseTone(value: number) {
    setTone(value);
    localStorage.setItem(TONE_KEY, String(value));
  }

  function jumpTo(id: string) {
    setQuery("");
    setActiveTab(id);
    const section = scrollRef.current?.querySelector<HTMLElement>(`[data-emoji-section="${id}"]`);
    if (section && scrollRef.current) scrollRef.current.scrollTop = section.offsetTop - 4;
  }

  function trackTab() {
    const box = scrollRef.current;
    if (!box || query) return;
    const sections = [...box.querySelectorAll<HTMLElement>("[data-emoji-section]")];
    const current = sections.filter((section) => section.offsetTop - 8 <= box.scrollTop).pop();
    if (current) setActiveTab(current.dataset.emojiSection ?? "recent");
  }

  const tabs = [{ id: "recent", icon: "🕘", label: "בשימוש לאחרונה" }, ...(groups ?? [])];

  return (
    <div
      className={cn(
        "flex h-[26rem] w-[min(23rem,calc(100vw-1rem))] flex-col overflow-hidden bg-white font-chat",
        className
      )}
    >
      <label className="mx-3 mt-3 mb-1.5 flex h-10 shrink-0 items-center gap-2 rounded-full bg-[#f1f3f4] px-3.5 text-[#5f6368]">
        <Search className="size-4 shrink-0" />
        <input
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          placeholder="חיפוש אימוג׳י"
          aria-label="חיפוש אימוג׳י"
          className="min-w-0 flex-1 bg-transparent text-sm text-[#1f1f1f] outline-none placeholder:text-[#80868b]"
        />
        {query ? (
          <button type="button" aria-label="ניקוי החיפוש" onClick={() => setQuery("")}>
            <X className="size-4" />
          </button>
        ) : null}
      </label>
      <div className="flex shrink-0 justify-between border-b border-[#eef0f3] px-2">
        {tabs.map((tab) => (
          <button
            key={tab.id}
            type="button"
            title={tab.label}
            aria-label={tab.label}
            onClick={() => jumpTo(tab.id)}
            className={cn(
              "flex h-9 w-8 items-center justify-center border-b-2 font-[family-name:var(--font-emoji)] text-lg transition-opacity",
              activeTab === tab.id && !query ? "border-[#0b57d0] opacity-100" : "border-transparent opacity-55 hover:opacity-90"
            )}
          >
            {tab.icon}
          </button>
        ))}
      </div>
      <div ref={scrollRef} onScroll={trackTab} className="relative min-h-0 flex-1 overflow-y-auto px-2 pb-2">
        {results ? (
          results.length ? (
            <EmojiGrid entries={results} tone={tone} onPick={pick} />
          ) : (
            <p className="py-10 text-center text-sm text-[#5f6368]">לא נמצא אימוג׳י</p>
          )
        ) : (
          <>
            <section data-emoji-section="recent">
              <h3 className="px-1.5 pt-2.5 pb-1 font-chat text-xs font-normal tracking-normal text-[#5f6368]">
                בשימוש לאחרונה
              </h3>
              <div className="grid grid-cols-8 sm:grid-cols-9">
                {recent.map((emoji) => (
                  <EmojiButton key={emoji} emoji={emoji} onPick={pick} />
                ))}
              </div>
            </section>
            {groups ? (
              groups.map((group) => (
                <section key={group.id} data-emoji-section={group.id}>
                  <h3 className="px-1.5 pt-2.5 pb-1 font-chat text-xs font-normal tracking-normal text-[#5f6368]">
                    {group.label}
                  </h3>
                  <EmojiGrid entries={group.emojis} tone={tone} onPick={pick} />
                </section>
              ))
            ) : (
              <p className="py-10 text-center text-sm text-[#5f6368]">טוען אימוג׳ים…</p>
            )}
          </>
        )}
      </div>
      <div className="flex shrink-0 items-center gap-1 border-t border-[#eef0f3] px-3 py-1.5 text-xs text-[#5f6368]">
        <span className="me-1">גוון עור:</span>
        {TONES.map((emoji, index) => (
          <button
            key={emoji}
            type="button"
            aria-label={`גוון ${index}`}
            aria-pressed={tone === index}
            onClick={() => chooseTone(index)}
            className={cn(
              "flex size-7 items-center justify-center rounded-full font-[family-name:var(--font-emoji)] text-lg",
              tone === index ? "bg-[#d3e3fd]" : "hover:bg-[#f1f3f4]"
            )}
          >
            {emoji}
          </button>
        ))}
      </div>
    </div>
  );
}

function EmojiGrid({
  entries,
  tone,
  onPick,
}: {
  entries: EmojiEntry[];
  tone: number;
  onPick: (emoji: string) => void;
}) {
  return (
    <div className="grid grid-cols-8 sm:grid-cols-9">
      {entries.map((entry) => (
        <EmojiButton key={entry[0]} emoji={withTone(entry, tone)} label={entry[1]} onPick={onPick} />
      ))}
    </div>
  );
}

function EmojiButton({
  emoji,
  label,
  onPick,
}: {
  emoji: string;
  label?: string;
  onPick: (emoji: string) => void;
}) {
  return (
    <button
      type="button"
      title={label}
      aria-label={label ?? emoji}
      onClick={() => onPick(emoji)}
      className="flex h-9 items-center justify-center rounded-lg font-[family-name:var(--font-emoji)] text-[1.45rem] leading-none hover:bg-[#e8f0fe]"
    >
      {emoji}
    </button>
  );
}
