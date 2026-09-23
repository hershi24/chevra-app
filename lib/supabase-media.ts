import { getServiceSupabase, isSupabaseEnabled } from "./supabase";

export async function saveMediaMeta(opts: {
  id: string;
  url: string;
  type: "image" | "video" | "audio" | "file";
  name: string;
  size: number;
  uploadedBy: string;
  gatheringId?: string;
}) {
  if (!isSupabaseEnabled()) return;
  const db = getServiceSupabase();
  if (!db) return;

  const row = {
    id: opts.id,
    url: opts.url,
    type: opts.type,
    name: opts.name,
    size: opts.size,
    gathering_id: opts.gatheringId ?? null,
    uploaded_by: opts.uploadedBy,
  };
  let { error } = await db.from("media_files").insert(row);
  if (error) {
    const retry = await db.from("media_files").insert({ ...row, uploaded_by: null });
    error = retry.error;
  }
  if (error) {
    console.error("Supabase media metadata failed", error);
  }
}
