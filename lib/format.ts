import type { Member, Role, RsvpStatus } from "./types";

export function formatDateHe(iso: string) {
  return new Intl.DateTimeFormat("he-IL", {
    weekday: "long",
    day: "numeric",
    month: "long",
    year: "numeric",
  }).format(new Date(iso));
}

export function formatDateShortHe(iso: string) {
  return new Intl.DateTimeFormat("he-IL", {
    day: "numeric",
    month: "short",
    year: "numeric",
  }).format(new Date(iso));
}

export function gatheringTitle(event: { title?: string }) {
  const title = event.title?.trim();
  return title ? title : null;
}

export function gatheringLabel(event: {
  title?: string;
  topic?: string;
  startsAt: string;
}) {
  return gatheringTitle(event) ?? event.topic?.trim() ?? formatDateHe(event.startsAt);
}

export function formatTimeHe(iso: string) {
  return new Intl.DateTimeFormat("he-IL", {
    hour: "2-digit",
    minute: "2-digit",
  }).format(new Date(iso));
}

export function formatDateTimeHe(iso: string) {
  return `${formatDateHe(iso)} · ${formatTimeHe(iso)}`;
}

function hebrewYear(year: number) {
  const letters: [number, string][] = [
    [400, "ת"], [300, "ש"], [200, "ר"], [100, "ק"],
    [90, "צ"], [80, "פ"], [70, "ע"], [60, "ס"], [50, "נ"],
    [40, "מ"], [30, "ל"], [20, "כ"], [10, "י"],
    [9, "ט"], [8, "ח"], [7, "ז"], [6, "ו"], [5, "ה"], [4, "ד"], [3, "ג"], [2, "ב"], [1, "א"],
  ];
  const thousands = Math.floor(year / 1000);
  let rest = year % 1000;
  let out = "";
  for (const [value, letter] of letters) {
    while (rest >= value) {
      out += letter;
      rest -= value;
    }
  }
  out = out.replace("יה", "טו").replace("יו", "טז");
  if (out.length > 1) out = `${out.slice(0, -1)}״${out.slice(-1)}`;
  else if (out) out = `${out}׳`;
  const prefix = thousands === 5 ? "ה׳" : "";
  return `${prefix}${out}`;
}

export function formatHebrewDate(iso: string) {
  const date = new Date(iso);
  const formatted = new Intl.DateTimeFormat("he-IL-u-ca-hebrew", {
    day: "numeric",
    month: "long",
    year: "numeric",
  }).format(date);
  const year = Number(
    new Intl.DateTimeFormat("en-u-ca-hebrew", { year: "numeric" }).format(date)
  );
  return Number.isFinite(year) ? formatted.replace(String(year), hebrewYear(year)) : formatted;
}

export function formatRelativeHe(iso: string) {
  const then = new Date(iso).getTime();
  const now = Date.now();
  const diff = Math.round((now - then) / 1000);
  if (diff < 60) return "עכשיו";
  if (diff < 3600) return `לפני ${Math.floor(diff / 60)} דק׳`;
  if (diff < 86400) return `לפני ${Math.floor(diff / 3600)} שע׳`;
  if (diff < 604800) return `לפני ${Math.floor(diff / 86400)} ימים`;
  return formatDateHe(iso);
}

export function roleLabel(role: Role) {
  if (role === "admin") return "מנהל מערכת";
  if (role === "leader") return "ראש החברה";
  return "חבר חבורה";
}

export function rsvpLabel(status: RsvpStatus) {
  if (status === "yes") return "מגיע";
  if (status === "no") return "לא מגיע";
  if (status === "maybe") return "אולי";
  return "טרם השיב";
}

export function memberById(members: Member[], id?: string) {
  return members.find((m) => m.id === id);
}

export function countdownParts(iso: string) {
  const diff = Math.max(0, new Date(iso).getTime() - Date.now());
  const total = Math.floor(diff / 1000);
  return {
    days: Math.floor(total / 86400),
    hours: Math.floor((total % 86400) / 3600),
    minutes: Math.floor((total % 3600) / 60),
    seconds: total % 60,
    expired: total <= 0,
  };
}
