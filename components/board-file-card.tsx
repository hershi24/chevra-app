"use client";

import { useEffect, useState } from "react";
import { BoardViewer } from "@/components/board-viewer";
import { pdfPageImages, pdfViewUrl } from "@/lib/pdf-preview";

const CARD =
  "overflow-hidden rounded-[1.5rem] border border-[#d5dbe3] bg-[#fbfcfd] text-start shadow-[0_10px_28px_rgba(80,90,105,0.05)]";

function isImageUrl(url: string) {
  return /\.(jpe?g|png|webp|gif)(\?|$)/i.test(url);
}

export function BoardFileCard({ title, url }: { title: string; url: string }) {
  const [pages, setPages] = useState<string[]>([]);
  const [failed, setFailed] = useState(false);
  const [embed, setEmbed] = useState(false);
  const [shown, setShown] = useState("");
  const [open, setOpen] = useState(false);
  const viewUrl = isImageUrl(url) ? "" : pdfViewUrl(url);

  useEffect(() => {
    if (isImageUrl(url)) return;
    let live = true;
    pdfPageImages(url)
      .then((images) => {
        if (!live) return;
        setPages(images);
        setFailed(images.length === 0);
        setEmbed(false);
        setShown(url);
      })
      .catch(() => {
        if (!live) return;
        setPages([]);
        setFailed(true);
        setShown(url);
        void fetch(pdfViewUrl(url), { credentials: "same-origin" })
          .then((response) => {
            if (live && response.ok) setEmbed(true);
          })
          .catch(() => undefined);
      });
    return () => {
      live = false;
    };
  }, [url]);

  const ready = isImageUrl(url) || shown === url;
  const preview = isImageUrl(url) ? url : ready ? pages[0] : undefined;
  const showFailed = ready && failed;

  return (
    <>
      {preview ? (
        <button type="button" className={CARD} onClick={() => setOpen(true)}>
          <img
            src={preview}
            alt={title}
            className="aspect-[3/4] w-full border-b border-[#e9ecef] bg-white object-cover object-top"
          />
          <span className="flex items-center justify-between gap-3 px-4 py-3">
            <span className="truncate text-[14.5px]">{title}</span>
            <span className="shrink-0 text-[12px] text-primary">צפייה</span>
          </span>
        </button>
      ) : showFailed && embed && viewUrl ? (
        <div className={CARD}>
          <iframe title={title} src={viewUrl} className="pointer-events-none aspect-[3/4] w-full border-b border-[#e9ecef] bg-white" />
          <button type="button" className="flex w-full items-center justify-between gap-3 px-4 py-3" onClick={() => setOpen(true)}>
            <span className="truncate text-[14.5px]">{title}</span>
            <span className="shrink-0 text-[12px] text-primary">צפייה</span>
          </button>
        </div>
      ) : (
        <div className={CARD}>
          <div className="grid aspect-[3/4] w-full place-items-center bg-[#f4f6f8] text-[13px] font-light text-muted-foreground">
            {showFailed ? "לא הצלחנו להציג את הדף" : "טוען את הדף…"}
          </div>
          <span className="block truncate px-4 py-3 text-[14.5px]">{title}</span>
        </div>
      )}
      {open && preview ? (
        <BoardViewer title={title} pages={isImageUrl(url) ? [url] : pages} onClose={() => setOpen(false)} />
      ) : null}
      {open && !preview && viewUrl ? <BoardViewer title={title} pages={[]} fileUrl={viewUrl} onClose={() => setOpen(false)} /> : null}
    </>
  );
}
