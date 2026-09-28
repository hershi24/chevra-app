"use client";

import {
  Download,
  File as FileIcon,
  FileArchive,
  FileAudio,
  FileImage,
  FileSpreadsheet,
  FileText,
  FileVideo,
  type LucideIcon,
} from "lucide-react";
import { fileExtension, formatFileSize } from "@/lib/media-kind";
import type { Attachment } from "@/lib/types";
import { cn } from "@/lib/utils";

const GROUPS: { exts: string[]; icon: LucideIcon; tone: string }[] = [
  { exts: ["pdf"], icon: FileText, tone: "bg-[#fbe9e7] text-[#b3412e]" },
  { exts: ["doc", "docx", "rtf", "odt", "txt", "md", "pages"], icon: FileText, tone: "bg-[#e8f0fe] text-[#1a5dc8]" },
  { exts: ["xls", "xlsx", "csv", "ods", "numbers"], icon: FileSpreadsheet, tone: "bg-[#e6f4ea] text-[#2f7350]" },
  { exts: ["ppt", "pptx", "odp", "key"], icon: FileText, tone: "bg-[#fdf1e3] text-[#b36b12]" },
  { exts: ["zip", "rar", "7z", "tar", "gz"], icon: FileArchive, tone: "bg-[#f1ecf9] text-[#6b4fa8]" },
  { exts: ["mp3", "m4a", "wav", "ogg", "opus", "flac", "aac", "amr"], icon: FileAudio, tone: "bg-[#f5f0e7] text-[#8d6424]" },
  { exts: ["mp4", "mov", "avi", "mkv", "webm", "m4v", "3gp"], icon: FileVideo, tone: "bg-[#eef1f4] text-[#46505c]" },
  { exts: ["jpg", "jpeg", "png", "gif", "webp", "heic", "heif", "svg", "tif", "tiff", "bmp"], icon: FileImage, tone: "bg-[#eef1f4] text-[#46505c]" },
];

export function ChatFileCard({ file, className }: { file: Attachment; className?: string }) {
  const ext = fileExtension(file.name);
  const group = GROUPS.find((item) => item.exts.includes(ext));
  const Icon = group?.icon ?? FileIcon;
  const meta = [ext ? ext.toUpperCase() : "קובץ", formatFileSize(file.size)].filter(Boolean).join(" · ");

  return (
    <a
      href={file.url}
      download={file.name}
      target="_blank"
      rel="noopener noreferrer"
      className={cn(
        "flex w-[16.5rem] max-w-full items-center gap-3 rounded-[14px] bg-white/80 px-3 py-2.5 text-start ring-1 ring-black/5 transition-colors hover:bg-white",
        className
      )}
    >
      <span
        className={cn(
          "inline-flex size-10 shrink-0 items-center justify-center rounded-[10px]",
          group?.tone ?? "bg-[#eef1f4] text-[#46505c]"
        )}
      >
        <Icon className="size-5" />
      </span>
      <span className="min-w-0 flex-1">
        <span className="block truncate text-[14px] leading-5" dir="auto">
          {file.name}
        </span>
        <span className="block text-[11.5px] text-[#5f6368]">{meta}</span>
      </span>
      <Download className="size-4 shrink-0 text-[#5f6368]" aria-label="הורדה" />
    </a>
  );
}
