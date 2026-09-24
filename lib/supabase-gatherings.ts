import { getServiceSupabase, isSupabaseEnabled } from "./supabase";
import type { AppState, EventMedia, Gathering, RsvpStatus } from "./types";

type GatheringRow = {
  id: string;
  title: string;
  starts_at: string;
  location: string;
  host_id: string | null;
  kibud_id: string | null;
  lecturer_id: string | null;
  topic: string | null;
  notes: string | null;
  summary: string | null;
  audio_url: string | null;
  status: Gathering["status"];
};

type RsvpRow = {
  gathering_id: string;
  member_id: string;
  status: RsvpStatus;
};

type MediaRow = {
  id: string;
  gathering_id: string;
  type: string;
  url: string;
  caption: string | null;
  uploaded_by: string | null;
  created_at: string;
};

function gatheringRow(event: Gathering) {
  return {
    id: event.id,
    title: event.title || "",
    starts_at: event.startsAt,
    location: event.location,
    host_id: event.hostId || null,
    kibud_id: event.kibudId || null,
    lecturer_id: event.lecturerId || null,
    topic: event.topic || null,
    notes: event.notes || null,
    summary: event.summary || null,
    audio_url: event.audioUrl || null,
    status: event.status,
  };
}

function sameGathering(a: Gathering, b: Gathering) {
  return JSON.stringify(gatheringRow(a)) === JSON.stringify(gatheringRow(b));
}

function sameRsvps(a: Gathering["rsvps"], b: Gathering["rsvps"]) {
  const keys = new Set([...Object.keys(a), ...Object.keys(b)]);
  for (const key of keys) {
    if (a[key] !== b[key]) return false;
  }
  return true;
}

function sameMedia(a: EventMedia[], b: EventMedia[]) {
  return JSON.stringify(a) === JSON.stringify(b);
}

export async function loadGatheringsFromSupabase(): Promise<Gathering[] | null> {
  if (!isSupabaseEnabled()) return null;
  const db = getServiceSupabase();
  if (!db) return null;

  const [gatheringsRes, rsvpsRes, mediaRes] = await Promise.all([
    db.from("gatherings").select("*"),
    db.from("rsvps").select("*"),
    db.from("media").select("*"),
  ]);
  if (gatheringsRes.error) throw gatheringsRes.error;
  if (rsvpsRes.error) throw rsvpsRes.error;
  if (mediaRes.error) throw mediaRes.error;

  const rsvps = new Map<string, Gathering["rsvps"]>();
  for (const row of (rsvpsRes.data ?? []) as RsvpRow[]) {
    const current = rsvps.get(row.gathering_id) ?? {};
    current[row.member_id] = row.status;
    rsvps.set(row.gathering_id, current);
  }

  const media = new Map<string, EventMedia[]>();
  for (const row of (mediaRes.data ?? []) as MediaRow[]) {
    if (row.type !== "image" && row.type !== "video" && row.type !== "audio") continue;
    const list = media.get(row.gathering_id) ?? [];
    list.push({
      id: row.id,
      type: row.type,
      url: row.url,
      caption: row.caption ?? undefined,
      uploadedBy: row.uploaded_by ?? "",
      createdAt: row.created_at,
    });
    media.set(row.gathering_id, list);
  }

  return ((gatheringsRes.data ?? []) as GatheringRow[]).map((row) => ({
    id: row.id,
    title: row.title,
    startsAt: row.starts_at,
    location: row.location,
    hostId: row.host_id ?? "",
    kibudId: row.kibud_id ?? undefined,
    lecturerId: row.lecturer_id ?? undefined,
    topic: row.topic ?? undefined,
    notes: row.notes ?? undefined,
    summary: row.summary ?? undefined,
    audioUrl: row.audio_url ?? undefined,
    status: row.status,
    rsvps: rsvps.get(row.id) ?? {},
    media: (media.get(row.id) ?? []).sort((a, b) => +new Date(a.createdAt) - +new Date(b.createdAt)),
  }));
}

export async function syncGatheringsDiff(before: AppState, after: AppState) {
  if (!isSupabaseEnabled()) return;
  const db = getServiceSupabase();
  if (!db) return;

  const removed = before.gatherings.filter(
    (event) => !after.gatherings.some((item) => item.id === event.id)
  );
  for (const event of removed) {
    await db.from("email_log").delete().eq("gathering_id", event.id);
    await db.from("ivr_log").delete().eq("gathering_id", event.id);
    const { error } = await db.from("gatherings").delete().eq("id", event.id);
    if (error) throw error;
  }

  for (const event of after.gatherings) {
    const prev = before.gatherings.find((item) => item.id === event.id);
    if (!prev || !sameGathering(prev, event)) {
      const { error } = await db.from("gatherings").upsert(gatheringRow(event));
      if (error) throw error;
    }
    if (!prev || !sameRsvps(prev.rsvps, event.rsvps)) {
      await replaceRsvps(event);
    }
    if (!prev || !sameMedia(prev.media, event.media)) {
      await replaceMedia(prev?.media ?? [], event);
    }
  }
}

async function replaceRsvps(event: Gathering) {
  const db = getServiceSupabase();
  if (!db) return;
  const { error: clearError } = await db.from("rsvps").delete().eq("gathering_id", event.id);
  if (clearError) throw clearError;
  const rows = Object.entries(event.rsvps).map(([memberId, status]) => ({
    gathering_id: event.id,
    member_id: memberId,
    status,
  }));
  if (!rows.length) return;
  const { error } = await db.from("rsvps").upsert(rows);
  if (error) throw error;
}

async function replaceMedia(previous: EventMedia[], event: Gathering) {
  const db = getServiceSupabase();
  if (!db) return;
  const kept = new Set(event.media.map((item) => item.id));
  const removed = previous.filter((item) => !kept.has(item.id));
  for (const item of removed) {
    const { error } = await db.from("media").delete().eq("id", item.id);
    if (error) throw error;
  }
  for (const item of event.media) {
    const row = {
      id: item.id,
      gathering_id: event.id,
      type: item.type,
      url: item.url,
      caption: item.caption || null,
      uploaded_by: item.uploadedBy || null,
      created_at: item.createdAt,
    };
    let { error } = await db.from("media").upsert(row);
    if (error && row.uploaded_by) {
      const retry = await db.from("media").upsert({ ...row, uploaded_by: null });
      error = retry.error;
    }
    if (error) throw error;
  }
}
