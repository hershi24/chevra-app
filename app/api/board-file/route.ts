import { readFile, stat } from "fs/promises";
import { NextResponse } from "next/server";
import { getSessionUser } from "@/lib/auth";
import { boardFileTarget, localBoardPdfPath, maxBoardPdfBytes } from "@/lib/board-file";

export const runtime = "nodejs";

const PDF_HEADERS = {
  "Content-Type": "application/pdf",
  "Content-Disposition": "inline",
  "Cache-Control": "private, max-age=300",
  "X-Content-Type-Options": "nosniff",
};

export async function GET(request: Request) {
  const me = await getSessionUser();
  if (!me) return new NextResponse(null, { status: 401 });

  const raw = new URL(request.url).searchParams.get("url") ?? "";
  const target = boardFileTarget(raw);
  if (!target) return new NextResponse(null, { status: 403 });

  try {
    const bytes = target.kind === "local" ? await readLocal(target.relative) : await readRemote(target.href);
    if (!bytes || !isPdf(bytes)) return new NextResponse(null, { status: 415 });
    return new NextResponse(new Uint8Array(bytes), { headers: PDF_HEADERS });
  } catch {
    return new NextResponse(null, { status: 404 });
  }
}

function isPdf(bytes: Buffer) {
  return bytes.subarray(0, 5).toString("latin1") === "%PDF-";
}

async function readLocal(relative: string) {
  const file = localBoardPdfPath(relative);
  if (!file) return null;
  const info = await stat(file);
  if (!info.isFile() || info.size > maxBoardPdfBytes()) return null;
  return readFile(file);
}

async function readRemote(href: string) {
  const response = await fetch(href, { redirect: "error" });
  if (!response.ok) return null;
  const type = (response.headers.get("content-type") || "").toLowerCase();
  if (type.includes("html") || type.includes("svg") || type.includes("javascript")) return null;
  const declared = Number(response.headers.get("content-length") || 0);
  if (declared > maxBoardPdfBytes()) return null;
  const reader = response.body?.getReader();
  if (!reader) return null;
  const chunks: Uint8Array[] = [];
  let total = 0;
  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    if (!value) continue;
    total += value.byteLength;
    if (total > maxBoardPdfBytes()) {
      await reader.cancel();
      return null;
    }
    chunks.push(value);
  }
  const bytes = Buffer.alloc(total);
  let offset = 0;
  for (const chunk of chunks) {
    bytes.set(chunk, offset);
    offset += chunk.byteLength;
  }
  return bytes;
}
