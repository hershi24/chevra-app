"use client";

import { useRef, useState, type ReactNode } from "react";
import { LayoutDashboard, Plus, X } from "lucide-react";
import { toast } from "sonner";
import { useApp } from "@/components/app-provider";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { pickedBoardPhotos, resolveBoard, visibleHomePhotos } from "@/lib/community-board";
import { readPdf } from "@/lib/pdf-preview";
import { uploadWithProgress } from "@/lib/upload-client";
import type { CommunityBoard } from "@/lib/types";
import { cn } from "@/lib/utils";

const PANEL = "overflow-hidden rounded-[1.4rem] border border-[#d5dbe3] bg-[#fbfcfd]";

export function CommunityBoardPanel() {
  const { state, act } = useApp();
  const [draft, setDraft] = useState<CommunityBoard | null>(null);
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [photoBusy, setPhotoBusy] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);
  const photoRef = useRef<HTMLInputElement>(null);
  if (!state) return null;
  const app = state;
  const board = draft ?? resolveBoard(app);
  const photos = visibleHomePhotos(board, app);

  function patch(next: CommunityBoard) {
    setDraft(next);
  }

  async function save(next: CommunityBoard, note: string) {
    setSaving(true);
    try {
      await act({ type: "setCommunityBoard", board: next });
      setDraft(next);
      toast.success(note);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "השמירה נכשלה");
    } finally {
      setSaving(false);
    }
  }

  async function uploadPdf(list: FileList | null) {
    const file = list?.[0];
    if (fileRef.current) fileRef.current.value = "";
    if (!file) return;
    const pdf = file.type === "application/pdf" || file.name.toLowerCase().endsWith(".pdf");
    if (!pdf) {
      toast.error("אפשר להעלות רק PDF");
      return;
    }
    if (file.size > 12 * 1024 * 1024) {
      toast.error("הקובץ גדול מדי");
      return;
    }
    setUploading(true);
    try {
      let body = "";
      try {
        body = (await readPdf(await file.arrayBuffer())).text;
      } catch {
        body = "";
      }
      const uploaded = await uploadWithProgress(file, {}, () => undefined);
      const title = file.name.replace(/\.pdf$/i, "").replace(/[_-]+/g, " ").trim() || "דף לימוד";
      await save(
        {
          ...board,
          files: [...board.files, { id: crypto.randomUUID(), title, url: uploaded.url, ...(body ? { body } : {}) }].slice(0, 8),
        },
        "הדף נוסף"
      );
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "ההעלאה נכשלה");
    } finally {
      setUploading(false);
    }
  }

  async function uploadPhoto(list: FileList | null) {
    const file = list?.[0];
    if (photoRef.current) photoRef.current.value = "";
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
    const base = Array.isArray(board.photos) ? board.photos : pickedBoardPhotos(board, app);
    if (base.length >= 24) {
      toast.error("אפשר עד 24 תמונות");
      return;
    }
    setPhotoBusy(true);
    try {
      const uploaded = await uploadWithProgress(file, {}, () => undefined);
      const caption = file.name.replace(/\.[^.]+$/, "").replace(/[_-]+/g, " ").trim() || "מהחבורה";
      await save(
        {
          ...board,
          photos: [...base, { id: crypto.randomUUID(), url: uploaded.url, caption }].slice(0, 24),
        },
        "התמונה נוספה"
      );
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "ההעלאה נכשלה");
    } finally {
      setPhotoBusy(false);
    }
  }

  function removePhoto(id: string) {
    const base = Array.isArray(board.photos) ? board.photos : photos;
    void save({ ...board, photos: base.filter((item) => item.id !== id) }, "התמונה נמחקה");
  }

  return (
    <div className={cn(PANEL, "mb-4")}>
      <div className="flex items-center gap-3.5 px-4 py-4 md:px-5">
        <span className="grid size-[38px] shrink-0 place-items-center rounded-xl bg-[#f5f0e7] text-primary">
          <LayoutDashboard className="size-4" />
        </span>
        <div className="min-w-0 flex-1">
          <div className="text-[15px]">לוח הבית</div>
          <div className="text-[12.5px] font-light text-muted-foreground">
            מודעות, זמנים, דפי לימוד, תמונות וסקר בדף הבית
          </div>
        </div>
        <Switch
          checked={board.enabled}
          disabled={saving}
          aria-label="לוח הבית"
          onCheckedChange={(checked) => void save({ ...board, enabled: checked }, checked ? "לוח הבית פעיל" : "חזרנו ללוח הרגיל")}
        />
      </div>

      <div className="grid gap-5 border-t border-[#e9ecef] px-4 py-4 md:px-5">
        <Field label="מודעות">
          {board.notices.map((notice, index) => (
            <div key={notice.id} className="grid gap-2 rounded-2xl border border-[#e9ecef] p-3">
              <div className="flex items-center gap-2">
                <Input
                  value={notice.title}
                  onChange={(event) => {
                    const notices = board.notices.map((item, at) =>
                      at === index ? { ...item, title: event.target.value } : item
                    );
                    patch({ ...board, notices });
                  }}
                  placeholder="כותרת"
                />
                <button
                  type="button"
                  className="text-[#9aa1ab]"
                  aria-label="הסרת מודעה"
                  onClick={() => patch({ ...board, notices: board.notices.filter((_, at) => at !== index) })}
                >
                  <X className="size-4" />
                </button>
              </div>
              <Textarea
                value={notice.body}
                rows={2}
                onChange={(event) => {
                  const notices = board.notices.map((item, at) =>
                    at === index ? { ...item, body: event.target.value } : item
                  );
                  patch({ ...board, notices });
                }}
                placeholder="תוכן"
              />
            </div>
          ))}
          <Add
            label="מודעה"
            onClick={() =>
              patch({
                ...board,
                notices: [...board.notices, { id: crypto.randomUUID(), title: "", body: "" }],
              })
            }
          />
        </Field>

        <Field label="זמני תפילה">
          {board.prayers.map((prayer, index) => (
            <div key={prayer.id} className="flex items-center gap-2">
              <Input
                value={prayer.name}
                onChange={(event) => {
                  const prayers = board.prayers.map((item, at) =>
                    at === index ? { ...item, name: event.target.value } : item
                  );
                  patch({ ...board, prayers });
                }}
                placeholder="שם"
              />
              <Input
                value={prayer.time}
                dir="ltr"
                className="max-w-28"
                onChange={(event) => {
                  const prayers = board.prayers.map((item, at) =>
                    at === index ? { ...item, time: event.target.value } : item
                  );
                  patch({ ...board, prayers });
                }}
                placeholder="06:30"
              />
              <button
                type="button"
                className="text-[#9aa1ab]"
                aria-label="הסרת זמן"
                onClick={() => patch({ ...board, prayers: board.prayers.filter((_, at) => at !== index) })}
              >
                <X className="size-4" />
              </button>
            </div>
          ))}
          <Add
            label="זמן"
            onClick={() =>
              patch({
                ...board,
                prayers: [...board.prayers, { id: crypto.randomUUID(), name: "", time: "" }],
              })
            }
          />
        </Field>

        <Field label="דפי לימוד">
          {board.files.map((file, index) => (
            <div key={file.id} className="grid gap-2 rounded-2xl border border-[#e9ecef] p-3">
              <div className="flex items-center gap-2">
                <Input
                  value={file.title}
                  onChange={(event) => {
                    const files = board.files.map((item, at) =>
                      at === index ? { ...item, title: event.target.value } : item
                    );
                    patch({ ...board, files });
                  }}
                  placeholder="כותרת"
                />
                <button
                  type="button"
                  className="text-[#9aa1ab]"
                  aria-label="מחיקת הדף"
                  disabled={saving}
                  onClick={() => void save({ ...board, files: board.files.filter((item) => item.id !== file.id) }, "הדף נמחק")}
                >
                  <X className="size-4" />
                </button>
              </div>
              {file.body ? (
                <p className="line-clamp-3 text-[13px] font-light leading-6 text-[#3f4650]">{file.body}</p>
              ) : null}
            </div>
          ))}
          <input
            ref={fileRef}
            type="file"
            accept="application/pdf,.pdf"
            className="hidden"
            onChange={(event) => void uploadPdf(event.target.files)}
          />
          {board.files.length < 8 ? (
            <button
              type="button"
              disabled={uploading || photoBusy || saving}
              onClick={() => fileRef.current?.click()}
              className="inline-flex w-fit items-center gap-1 text-[13px] text-primary"
            >
              <Plus className="size-3.5" />
              {uploading ? "מעלה…" : "העלאת PDF"}
            </button>
          ) : null}
        </Field>

        <Field label="סקר">
          <Input
            value={board.poll.question}
            onChange={(event) => patch({ ...board, poll: { ...board.poll, question: event.target.value } })}
          />
          {board.poll.options.map((option, index) => (
            <div key={option.id} className="flex items-center gap-2">
              <Input
                value={option.label}
                onChange={(event) => {
                  const options = board.poll.options.map((item, at) =>
                    at === index ? { ...item, label: event.target.value } : item
                  );
                  patch({ ...board, poll: { ...board.poll, options } });
                }}
              />
              {board.poll.options.length > 2 ? (
                <button
                  type="button"
                  className="text-[#9aa1ab]"
                  aria-label="הסרת אפשרות"
                  onClick={() =>
                    patch({
                      ...board,
                      poll: { ...board.poll, options: board.poll.options.filter((_, at) => at !== index) },
                    })
                  }
                >
                  <X className="size-4" />
                </button>
              ) : null}
            </div>
          ))}
          <Add
            label="אפשרות"
            onClick={() =>
              patch({
                ...board,
                poll: {
                  ...board.poll,
                  options: [...board.poll.options, { id: crypto.randomUUID(), label: "", voterIds: [] }],
                },
              })
            }
          />
        </Field>

        <Field label="תמונות בלוח">
          <p className="text-[12.5px] font-light text-muted-foreground">
            התמונות שמופיעות בדף הבית. אפשר להעלות ולמחוק.
          </p>
          {photos.length ? (
            <div className="grid grid-cols-3 gap-2 sm:grid-cols-4">
              {photos.map((photo) => (
                <div key={photo.id} className="relative overflow-hidden rounded-xl border border-[#e9ecef]">
                  <img src={photo.url} alt={photo.caption} className="aspect-square w-full object-cover" />
                  <button
                    type="button"
                    aria-label="מחיקת התמונה"
                    disabled={saving || photoBusy}
                    onClick={() => removePhoto(photo.id)}
                    className="absolute top-1.5 left-1.5 grid size-7 place-items-center rounded-full bg-white/95 text-[#3f4650] shadow-sm"
                  >
                    <X className="size-3.5" />
                  </button>
                </div>
              ))}
            </div>
          ) : (
            <p className="text-[12.5px] font-light text-muted-foreground">אין תמונות בלוח.</p>
          )}
          <input
            ref={photoRef}
            type="file"
            accept="image/jpeg,image/png,image/webp,image/gif,.jpg,.jpeg,.png,.webp,.gif"
            className="hidden"
            onChange={(event) => void uploadPhoto(event.target.files)}
          />
          {photos.length < 24 ? (
            <button
              type="button"
              disabled={photoBusy || uploading || saving}
              onClick={() => photoRef.current?.click()}
              className="inline-flex w-fit items-center gap-1 text-[13px] text-primary"
            >
              <Plus className="size-3.5" />
              {photoBusy ? "מעלה…" : "העלאת תמונה"}
            </button>
          ) : null}
        </Field>

        <Button
          type="button"
          disabled={saving}
          className="h-10 w-fit rounded-full px-5"
          onClick={() => void save(board, "הלוח נשמר")}
        >
          שמירת הלוח
        </Button>
      </div>
    </div>
  );
}

function Field({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="grid gap-2">
      <div className="text-[13px] text-[#3f4650]">{label}</div>
      {children}
    </div>
  );
}

function Add({ label, onClick }: { label: string; onClick: () => void }) {
  return (
    <button type="button" onClick={onClick} className="inline-flex w-fit items-center gap-1 text-[13px] text-primary">
      <Plus className="size-3.5" />
      {label}
    </button>
  );
}
