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
  if (role === "leader") return "מגיד שיעור";
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
