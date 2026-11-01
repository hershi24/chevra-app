"use client";

import { useEffect, useState } from "react";
import { Download } from "lucide-react";
import { cn } from "@/lib/utils";

export function DownloadAppButton({
  className,
  compact = false,
}: {
  className?: string;
  compact?: boolean;
}) {
  const [installed, setInstalled] = useState(false);

  useEffect(() => {
    const standalone =
      window.matchMedia("(display-mode: standalone)").matches ||
      window.matchMedia("(display-mode: fullscreen)").matches;
    setInstalled(standalone);
  }, []);

  if (installed) return null;

  return (
    <a
      href="/meinchevra.apk"
      download="מיין-חברה.apk"
      className={cn(
        "inline-flex shrink-0 items-center gap-1.5 rounded-full border border-[#d5dbe3] bg-white font-normal text-foreground hover:bg-[#f4f6f8]",
        compact ? "px-2.5 py-1.5 text-[12px]" : "px-3 py-1.5 text-[13px]",
        className
      )}
      aria-label="הורדת אפליקציה"
      title="הורדת אפליקציה"
    >
      <Download className={compact ? "size-3.5" : "size-4"} />
      {compact ? (
        <>
          <span className="hidden min-[380px]:inline">הורדת אפליקציה</span>
          <span className="min-[380px]:hidden">אפליקציה</span>
        </>
      ) : (
        <span className="hidden lg:inline">הורדת אפליקציה</span>
      )}
    </a>
  );
}
