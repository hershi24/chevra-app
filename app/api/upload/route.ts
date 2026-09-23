import { mkdir, writeFile } from "fs/promises";
import path from "path";
import { NextResponse } from "next/server";
import { getSessionUser } from "@/lib/auth";
import { can } from "@/lib/permissions";
import { isR2Enabled, uploadToR2 } from "@/lib/r2";
import { saveMediaMeta } from "@/lib/supabase-media";

export const runtime = "nodejs";

export async function POST(request: Request) {
  const me = await getSessionUser();
  if (!me || !can(me, "uploadMedia")) {
    return NextResponse.json({ error: "אין הרשאה" }, { status: 403 });
  }

  const form = await request.formData();
  const file = form.get("file");
  if (!(file instanceof File)) {
    return NextResponse.json({ error: "חסר קובץ" }, { status: 400 });
  }

  const bytes = Buffer.from(await file.arrayBuffer());
  const ext = path.extname(file.name) || mimeExt(file.type);
  const key = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}${ext}`;
  const gatheringId = String(form.get("gatheringId") || "").trim() || undefined;
  const kind = mediaKind(file.type);

  let url: string;
  try {
    if (isR2Enabled()) {
      url = await uploadToR2({
        key,
        body: bytes,
        contentType: file.type,
      });
    } else {
      const dir = path.join(process.cwd(), "public", "uploads");
      await mkdir(dir, { recursive: true });
      await writeFile(path.join(dir, key), bytes);
      url = `/uploads/${key}`;
    }
  } catch (error) {
    console.error("media upload failed", error);
    return NextResponse.json({ error: "העלאה נכשלה" }, { status: 500 });
  }

  const id = crypto.randomUUID();
  try {
    await saveMediaMeta({
      id,
      url,
      type: kind,
      name: file.name,
      size: file.size,
      uploadedBy: me.id,
      gatheringId,
    });
  } catch (error) {
    console.error(error);
  }

  return NextResponse.json({
    id,
    url,
    name: file.name,
    type: file.type,
    size: file.size,
  });
}

function mediaKind(type: string): "image" | "video" | "audio" | "file" {
  if (type.startsWith("video")) return "video";
  if (type.startsWith("audio")) return "audio";
  if (type.startsWith("image")) return "image";
  return "file";
}

function mimeExt(type: string) {
  if (type.includes("png")) return ".png";
  if (type.includes("jpeg") || type.includes("jpg")) return ".jpg";
  if (type.includes("webp")) return ".webp";
  if (type.includes("gif")) return ".gif";
  if (type.includes("webm")) return ".webm";
  if (type.includes("mp4")) return ".mp4";
  if (type.includes("mpeg") || type.includes("mp3")) return ".mp3";
  if (type.includes("wav")) return ".wav";
  return "";
}
