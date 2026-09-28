export type MediaKind = "image" | "video" | "audio" | "file";

const AUDIO_EXT = new Set(["mp3", "m4a", "aac", "wav", "ogg", "oga", "opus", "flac", "weba"]);
const VIDEO_EXT = new Set(["mp4", "m4v", "mov", "webm"]);
const IMAGE_EXT = new Set(["jpg", "jpeg", "png", "gif", "webp", "avif", "heic", "heif"]);

/** Browsers can execute these when opened directly, so they are only ever served as downloads. */
const ACTIVE_EXT = new Set(["html", "htm", "xhtml", "shtml", "svg", "svgz", "xml", "xsl", "js", "mjs"]);

export function fileExtension(name: string) {
  const match = /\.([a-z0-9]{1,8})$/i.exec(name.trim());
  return match ? match[1].toLowerCase() : "";
}

export function isActiveContent(type: string, name: string) {
  const mime = type.toLowerCase();
  return (
    ACTIVE_EXT.has(fileExtension(name)) ||
    mime.includes("html") ||
    mime.includes("svg") ||
    mime.includes("xml") ||
    mime.includes("javascript")
  );
}

export function mediaKind(type: string, name = ""): MediaKind {
  if (isActiveContent(type, name)) return "file";
  if (type.startsWith("video")) return "video";
  if (type.startsWith("audio")) return "audio";
  if (type.startsWith("image")) return "image";
  if (type && type !== "application/octet-stream") return "file";
  const ext = fileExtension(name);
  if (AUDIO_EXT.has(ext)) return "audio";
  if (VIDEO_EXT.has(ext)) return "video";
  if (IMAGE_EXT.has(ext) && ext !== "heic" && ext !== "heif") return "image";
  return "file";
}

export function formatFileSize(bytes?: number) {
  if (!bytes || bytes < 0) return "";
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} KB`;
  const mb = bytes / (1024 * 1024);
  return `${mb < 10 ? mb.toFixed(1) : Math.round(mb)} MB`;
}
