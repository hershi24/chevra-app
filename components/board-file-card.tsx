"use client";

import { useEffect, useState } from "react";
import { BoardViewer } from "@/components/board-viewer";
import { pdfPageImages } from "@/lib/pdf-preview";

const CARD =
  "overflow-hidden rounded-[1.5rem] border border-[#d5dbe3] bg-[#fbfcfd] text-start shadow-[0_10px_28px_rgba(80,90,105,0.05)]";

function isImageUrl(url: string) {
  return /\.(jpe?g|png|webp|gif)(\?|$)/i.test(url);
}

export function BoardFileCard({ title, url }: { title: string; url: string }) {
  const [pages, setPages] = useState<string[]>(() => (isImageUrl(url) ? [url] : []));
  const [failed, setFailed] = useState(false);
  const [open, setOpen] = useState(false);

  useEffect(() => {
    if (isImageUrl(url)) {
      setPages([url]);
      setFailed(false);
      return;
    }
    let live = true;
    setPages([]);
    setFailed(false);
    pdfPageImages(url)
      .then((images) => {
        if (!live) return;
        setPages(images);
        setFailed(images.length === 0);
      })
      .catch(() => {
        if (live) setFailed(true);
      });
    return () => {
      live = false;
    };
  }, [url]);

  const preview = pages[0];

  return (
    <>
      <button type="button" className={CARD} onClick={() => preview && setOpen(true)} disabled={!preview}>
        {preview ? (
          <img
            src={preview}
            alt={title}
            className="aspect-[3/4] w-full border-b border-[#e9ecef] bg-white object-cover object-top"
          />
        ) : (
          <div className="grid aspect-[3/4] w-full place-items-center bg-[#f4f6f8] text-[13px] font-light text-muted-foreground">
            {failed ? "לא הצלחנו להציג את הדף" : "טוען את הדף…"}
          </div>
        )}
        <span className="flex items-center justify-between gap-3 px-4 py-3">
          <span className="truncate text-[14.5px]">{title}</span>
          {preview ? <span className="shrink-0 text-[12px] text-primary">צפייה</span> : null}
        </span>
      </button>
      {open && preview ? <BoardViewer title={title} pages={pages} onClose={() => setOpen(false)} /> : null}
    </>
  );
}
