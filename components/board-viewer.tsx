"use client";

import { useEffect } from "react";
import { X } from "lucide-react";

export function BoardViewer({
  title,
  pages,
  fileUrl,
  onClose,
}: {
  title: string;
  pages: string[];
  fileUrl?: string;
  onClose: () => void;
}) {
  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    const previous = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      window.removeEventListener("keydown", onKey);
      document.body.style.overflow = previous;
    };
  }, [onClose]);

  return (
    <div className="fixed inset-0 z-50 flex flex-col bg-[#1c2128]/92" role="dialog" aria-modal="true" aria-label={title}>
      <div className="flex items-center justify-between gap-3 px-4 py-3 text-white">
        <h2 className="truncate text-[16px]">{title}</h2>
        <button
          type="button"
          onClick={onClose}
          aria-label="סגירה"
          className="grid size-9 shrink-0 place-items-center rounded-full bg-white/15"
        >
          <X className="size-4" />
        </button>
      </div>
      <div className="min-h-0 flex-1 px-3 pb-4 sm:px-4">
        {fileUrl ? (
          <iframe title={title} src={fileUrl} className="mx-auto h-full min-h-[78vh] w-full max-w-4xl rounded-xl bg-white" />
        ) : (
          <div className="mx-auto flex max-w-3xl flex-col gap-4 overflow-y-auto">
            {pages.map((src, index) => (
              <img key={`${src.slice(0, 24)}-${index}`} src={src} alt="" className="w-full rounded-xl bg-white" />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
