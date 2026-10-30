import type { AppState, IvrLog, SiteVisit } from "./types";

const KEEP = 200;
const STALE_MS = 2 * 60_000;

export function settleVisits(visits: SiteVisit[], now = Date.now(), online: ReadonlySet<string> = new Set()) {
  return visits.map((visit) => {
    if (visit.endedAt || online.has(visit.memberId)) return visit;
    if (now - new Date(visit.lastSeen).getTime() < STALE_MS) return visit;
    return { ...visit, endedAt: visit.lastSeen };
  });
}

export function mergeVisits(local: SiteVisit[], incoming: SiteVisit[]) {
  const byId = new Map(incoming.map((visit) => [visit.id, visit]));
  for (const visit of local) {
    const previous = byId.get(visit.id);
    if (!previous || visit.lastSeen > previous.lastSeen) byId.set(visit.id, visit);
  }
  return [...byId.values()].sort((a, b) => +new Date(b.startedAt) - +new Date(a.startedAt)).slice(0, KEEP);
}

export function mergeCalls(local: IvrLog[], incoming: IvrLog[]) {
  const byId = new Map(incoming.map((entry) => [entry.id, entry]));
  for (const entry of local) byId.set(entry.id, entry);
  return [...byId.values()].sort((a, b) => +new Date(b.at) - +new Date(a.at)).slice(0, KEEP);
}

/** Record that a member opened the site, is still in it, or left. */
export function recordVisit(state: AppState, memberId: string, kind: "enter" | "beat" | "leave", now = new Date()) {
  const iso = now.toISOString();
  // Keep this member's open visit while we settle everyone else, including on leave.
  const visits = settleVisits(state.visits ?? [], now.getTime(), new Set([memberId]));
  const open = visits.find((visit) => visit.memberId === memberId && !visit.endedAt);
  if (kind === "beat") {
    if (!open) return false;
    open.lastSeen = iso;
  } else if (kind === "leave") {
    if (!open) return false;
    open.lastSeen = iso;
    open.endedAt = iso;
  } else if (open) {
    open.lastSeen = iso;
  } else {
    visits.unshift({ id: crypto.randomUUID(), memberId, startedAt: iso, lastSeen: iso });
  }
  state.visits = visits.slice(0, KEEP);
  return true;
}

export function stayLength(visit: SiteVisit, now = Date.now()) {
  const start = new Date(visit.startedAt).getTime();
  const end = visit.endedAt ? new Date(visit.endedAt).getTime() : now;
  return Math.max(0, end - start);
}

export function formatStay(ms: number) {
  const minutes = Math.round(ms / 60_000);
  if (minutes < 1) return "פחות מדקה";
  if (minutes < 60) return minutes === 1 ? "דקה" : `${minutes} דקות`;
  const hours = Math.floor(minutes / 60);
  const rest = minutes % 60;
  const hoursLabel = hours === 1 ? "שעה" : `${hours} שעות`;
  if (!rest) return hoursLabel;
  return `${hoursLabel} ו${rest} דק׳`;
}
