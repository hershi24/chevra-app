"use client";

import { useRef, useState, type ReactNode } from "react";
import { LayoutDashboard, Plus, X } from "lucide-react";
import { toast } from "sonner";
import { useApp } from "@/components/app-provider";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { resolveBoard } from "@/lib/community-board";
import { uploadWithProgress } from "@/lib/upload-client";
import { galleryItems } from "@/lib/selectors";
import type { CommunityBoard } from "@/lib/types";
import { cn } from "@/lib/utils";

const PANEL = "overflow-hidden rounded-[1.4rem] border border-[#d5dbe3] bg-[#fbfcfd]";

export function CommunityBoardPanel() {
  const { state, act } = useApp();
  const [draft, setDraft] = useState<CommunityBoard | null>(null);
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [noticeBusy, setNoticeBusy] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);
  const noticeRef = useRef<HTMLInputElement>(null);
  if (!state) return null;
  const board = draft ?? resolveBoard(state);
  const images = galleryItems(state).filter((item) => item.type === "image");

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
      const uploaded = await uploadWithProgress(file, {}, () => undefined);
      const title = file.name.replace(/\.pdf$/i, "").replace(/[_-]+/g, " ").trim() || "דף לימוד";
      await save(
        {
          ...board,
          files: [...board.files, { id: crypto.randomUUID(), title, url: uploaded.url }].slice(0, 8),
        },
        "הדף נוסף"
      );
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "ההעלאה נכשלה");
    } finally {
      setUploading(false);
    }
  }

  async function uploadNoticeImage(list: FileList | null) {
    const file = list?.[0];
    if (noticeRef.current) noticeRef.current.value = "";
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
    if (board.notices.length >= 8) {
      toast.error("אפשר עד 8 מודעות");
      return;
    }
    setNoticeBusy(true);
    try {
      const uploaded = await uploadWithProgress(file, {}, () => undefined);
      const title = file.name.replace(/\.[^.]+$/, "").replace(/[_-]+/g, " ").trim() || "מודעה";
      await save(
        {
          ...board,
          notices: [...board.notices, { id: crypto.randomUUID(), title, body: "", image: uploaded.url }].slice(0, 8),
        },
        "המודעה נוספה"
      );
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "ההעלאה נכשלה");
    } finally {
      setNoticeBusy(false);
    }
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
                  disabled={saving || noticeBusy}
                  onClick={() => {
                    const notices = board.notices.filter((item) => item.id !== notice.id);
                    if (notice.image) void save({ ...board, notices }, "המודעה נמחקה");
                    else patch({ ...board, notices });
                  }}
                >
                  <X className="size-4" />
                </button>
              </div>
              {notice.image ? (
                <img src={notice.image} alt="" className="h-28 w-24 rounded-xl object-cover" />
              ) : (
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
              )}
            </div>
          ))}
          <input
            ref={noticeRef}
            type="file"
            accept="image/jpeg,image/png,image/webp,image/gif,.jpg,.jpeg,.png,.webp,.gif"
            className="hidden"
            onChange={(event) => void uploadNoticeImage(event.target.files)}
          />
          {board.notices.length < 8 ? (
            <button
              type="button"
              disabled={noticeBusy || uploading || saving}
              onClick={() => noticeRef.current?.click()}
              className="inline-flex w-fit items-center gap-1 text-[13px] text-primary"
            >
              <Plus className="size-3.5" />
              {noticeBusy ? "מעלה…" : "העלאת תמונת מודעה"}
            </button>
          ) : null}
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
          <p className="text-[12.5px] font-light text-muted-foreground">
            הדף מופיע בדף הבית כתמונה, והחברים פותחים אותו לצפייה.
          </p>
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
              disabled={uploading || noticeBusy || saving}
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
            רק תמונות מסומנות מופיעות. בלי סימון מוצגות תמונות הספרים.
          </p>
          {images.length ? (
            <div className="grid max-h-80 grid-cols-3 gap-2 overflow-y-auto sm:grid-cols-4">
              {images.map((item) => {
                const on = board.photoIds.includes(item.id);
                return (
                  <button
                    key={item.id}
                    type="button"
                    onClick={() =>
                      patch({
                        ...board,
                        photoIds: on
                          ? board.photoIds.filter((id) => id !== item.id)
                          : [...board.photoIds, item.id],
                      })
                    }
                    className={cn(
                      "overflow-hidden rounded-xl border",
                      on ? "border-primary" : "border-transparent opacity-70"
                    )}
                  >
                    <img src={item.url} alt={item.caption ?? ""} className="aspect-square w-full object-cover" />
                  </button>
                );
              })}
            </div>
          ) : (
            <p className="text-[12.5px] font-light text-muted-foreground">אין עדיין תמונות בגלריה.</p>
          )}
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
