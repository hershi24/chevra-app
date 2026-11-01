"use client";

import { useEffect, useRef, useState } from "react";
import { ImageIcon, X } from "lucide-react";
import { toast } from "sonner";
import { useApp } from "@/components/app-provider";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { promoActive } from "@/lib/entrance-promo";
import { uploadWithProgress } from "@/lib/upload-client";
import { cn } from "@/lib/utils";

const PANEL = "overflow-hidden rounded-[1.4rem] border border-[#d5dbe3] bg-[#fbfcfd]";

function closedKey(id: string) {
  return `chevra-promo-closed:${id}`;
}

export function EntrancePromoOverlay() {
  const { state, me, act } = useApp();
  const promo = state?.settings.entrancePromo ?? null;
  const closing = useRef(false);
  const [phase, setPhase] = useState<"in" | "out" | "gone">("gone");
  const [shownId, setShownId] = useState<string | null>(null);
  const active = Boolean(promo && me && promoActive(promo, me.id));
  const promoId = promo?.id ?? "";

  useEffect(() => {
    if (closing.current) return;
    if (!active || !promoId || sessionStorage.getItem(closedKey(promoId))) {
      setPhase("gone");
      return;
    }
    setShownId(promoId);
    setPhase("in");
  }, [active, promoId]);

  useEffect(() => {
    if (phase === "gone") return;
    const previous = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = previous;
    };
  }, [phase]);

  function finish() {
    window.setTimeout(() => {
      closing.current = false;
      setPhase("gone");
    }, 280);
  }

  function closeVisit() {
    if (!shownId || phase === "out") return;
    sessionStorage.setItem(closedKey(shownId), "1");
    closing.current = true;
    setPhase("out");
    finish();
  }

  async function markRead() {
    if (!shownId || phase === "out") return;
    sessionStorage.setItem(closedKey(shownId), "1");
    closing.current = true;
    setPhase("out");
    finish();
    try {
      await act({ type: "dismissEntrancePromo" });
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "לא הצלחנו לשמור");
    }
  }

  useEffect(() => {
    if (phase === "gone") return;
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") closeVisit();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  });

  if (phase === "gone" || !promo?.imageUrl) return null;

  return (
    <div
      className={cn(
        "fixed inset-0 z-[70] flex items-center justify-center bg-black",
        phase === "in" ? "promo-in" : "promo-out"
      )}
      role="dialog"
      aria-modal="true"
      aria-label="הודעה"
    >
      <style>{`
        @keyframes promo-in {
          from { opacity: 0; transform: scale(0.96); }
          to { opacity: 1; transform: scale(1); }
        }
        @keyframes promo-out {
          from { opacity: 1; transform: scale(1); }
          to { opacity: 0; transform: scale(1.03); }
        }
        .promo-in { animation: promo-in 320ms ease-out both; }
        .promo-out { animation: promo-out 260ms ease-in both; }
      `}</style>
      <img src={promo.imageUrl} alt="" className="h-full w-full object-cover md:object-contain" />
      <button
        type="button"
        onClick={closeVisit}
        className="absolute top-[max(0.75rem,env(safe-area-inset-top))] left-[max(0.75rem,env(safe-area-inset-left))] grid size-11 place-items-center rounded-full bg-black/55 text-white ring-1 ring-white/80"
        aria-label="יציאה"
      >
        <X className="size-5" />
      </button>
      <div className="absolute inset-x-0 bottom-0 flex justify-center px-5 pb-[max(1.25rem,env(safe-area-inset-bottom))]">
        <Button
          type="button"
          onClick={() => void markRead()}
          className="h-11 rounded-full bg-white px-6 text-black hover:bg-white/90"
        >
          קראתי, אל תציג לי שוב
        </Button>
      </div>
    </div>
  );
}

export function EntrancePromoPanel() {
  const { state, act } = useApp();
  const current = state?.settings.entrancePromo ?? null;
  const [until, setUntil] = useState(current?.until ?? "");
  const [imageUrl, setImageUrl] = useState(current?.imageUrl ?? "");
  const [busy, setBusy] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    setUntil(current?.until ?? "");
    setImageUrl(current?.imageUrl ?? "");
  }, [current?.id, current?.until, current?.imageUrl]);

  async function upload(list: FileList | null) {
    const file = list?.[0];
    if (fileRef.current) fileRef.current.value = "";
    if (!file) return;
    const image = /^image\/(jpeg|png|webp|gif)$/.test(file.type) || /\.(jpe?g|png|webp|gif)$/i.test(file.name);
    if (!image) {
      toast.error("אפשר להעלות רק תמונה");
      return;
    }
    if (file.size > 12 * 1024 * 1024) {
      toast.error("הקובץ גדול מדי");
      return;
    }
    setBusy(true);
    try {
      const uploaded = await uploadWithProgress(file, {}, () => undefined);
      setImageUrl(uploaded.url);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "ההעלאה נכשלה");
    } finally {
      setBusy(false);
    }
  }

  async function save() {
    if (!imageUrl || !until) {
      toast.error("צריך תמונה ותאריך סיום");
      return;
    }
    setBusy(true);
    try {
      await act({ type: "setEntrancePromo", promo: { imageUrl, until } });
      toast.success("הפרסומת נשמרה");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "השמירה נכשלה");
    } finally {
      setBusy(false);
    }
  }

  async function clear() {
    setBusy(true);
    try {
      await act({ type: "setEntrancePromo", promo: null });
      setImageUrl("");
      setUntil("");
      toast.success("הפרסומת הוסרה");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "ההסרה נכשלה");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className={cn(PANEL, "mb-4")}>
      <div className="flex items-center gap-3.5 px-4 py-4 md:px-5">
        <span className="grid size-[38px] shrink-0 place-items-center rounded-xl bg-[#f5f0e7] text-primary">
          <ImageIcon className="size-4" />
        </span>
        <div className="min-w-0 flex-1">
          <div className="text-[15px]">פרסומת בכניסה</div>
          <div className="text-[12.5px] font-light leading-5 text-muted-foreground">
            תמונה לאורך שקופצת במסך מלא בדשבורד. יציאה מציגה אותה שוב בכניסה הבאה. «קראתי» מסתיר אותה מהחבר הזה.
          </div>
        </div>
      </div>
      <div className="grid gap-3 border-t border-[#e9ecef] px-4 py-4 md:px-5">
        {imageUrl ? (
          <img src={imageUrl} alt="" className="mx-auto max-h-72 w-auto rounded-xl bg-black object-contain" />
        ) : (
          <div className="grid h-36 place-items-center rounded-xl bg-[#f4f6f8] text-[13px] text-muted-foreground">
            עדיין אין תמונה
          </div>
        )}
        <div className="flex flex-wrap items-center gap-2">
          <input
            ref={fileRef}
            type="file"
            accept="image/jpeg,image/png,image/webp,image/gif"
            className="hidden"
            onChange={(event) => void upload(event.target.files)}
          />
          <Button type="button" variant="outline" className="h-10 rounded-full" disabled={busy} onClick={() => fileRef.current?.click()}>
            {busy ? "מעלה…" : imageUrl ? "החלפת תמונה" : "העלאת תמונה"}
          </Button>
          <label className="flex items-center gap-2 text-[13px] text-muted-foreground">
            תוצג עד
            <Input
              type="date"
              value={until}
              onChange={(event) => setUntil(event.target.value)}
              className="h-10 w-auto rounded-full bg-white"
              dir="ltr"
            />
          </label>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button type="button" className="h-10 rounded-full px-5" disabled={busy || !imageUrl || !until} onClick={() => void save()}>
            שמירה
          </Button>
          {current ? (
            <Button type="button" variant="outline" className="h-10 rounded-full" disabled={busy} onClick={() => void clear()}>
              הסרה
            </Button>
          ) : null}
        </div>
      </div>
    </div>
  );
}
