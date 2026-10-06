"use client";

import { useEffect, useState } from "react";
import { readPdf } from "@/lib/pdf-preview";
import { cn } from "@/lib/utils";

const CARD =
  "rounded-[1.5rem] border border-[#d5dbe3] bg-[#fbfcfd] shadow-[0_10px_28px_rgba(80,90,105,0.05)]";

export function BoardFileCard({
  title,
  url,
  body,
}: {
  title: string;
  url: string;
  body?: string;
}) {
  const written = body?.trim() ?? "";
  const [text, setText] = useState(written);
  const [image, setImage] = useState("");

  useEffect(() => {
    if (written.length >= 20) {
      setText(written);
      setImage("");
      return;
    }
    let live = true;
    readPdf(url)
      .then((result) => {
        if (!live) return;
        const next = written || result.text;
        setText(next);
        setImage(next.trim().length >= 20 ? "" : result.image);
      })
      .catch(() => {
        if (live) setText(written);
      });
    return () => {
      live = false;
    };
  }, [url, written]);

  return (
    <article className={cn(CARD, "px-5 py-4")}>
      <h3 className="text-[16px]">{title}</h3>
      {text ? (
        <p className="mt-1.5 whitespace-pre-wrap text-[14px] font-light leading-7 text-[#3f4650]">{text}</p>
      ) : null}
      {image ? <img src={image} alt="" className="mt-3 w-full rounded-xl bg-white" /> : null}
    </article>
  );
}
