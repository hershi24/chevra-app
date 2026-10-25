"use client";

import { useRef, useState, type ReactNode } from "react";
import { Calendar, FileText, Image as ImageIcon, LayoutDashboard, Megaphone, Plus, Vote, X } from "lucide-react";
import { toast } from "sonner";
import { useApp } from "@/components/app-provider";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { pickedBoardPhotos, resolveBoard, visibleHomePhotos } from "@/lib/community-board";
import { uploadWithProgress } from "@/lib/upload-client";
import type { CommunityBoard } from "@/lib/types";
import { cn } from "@/lib/utils";

const PANEL = "overflow-hidden rounded-[1.4rem] border border-[#d5dbe3] bg-[#fbfcfd]";

type BoardTab = "notices" | "prayers" | "files" | "poll" | "photos";

export function CommunityBoardPanel({ tabbed = false }: { tabbed?: boolean }) {
  const { state, act } = useApp();
  const [tab, setTab] = useState<BoardTab>("notices");
  const [draft, setDraft] = useState<CommunityBoard | null>(null);
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [noticeBusy, setNoticeBusy] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);
  const noticeRef = useRef<HTMLInputElement>(null);
  const [photoBusy, setPhotoBusy] = useState(false);
  const photoRef = useRef<HTMLInputElement>(null);
  if (!state) return null;
  const app = state;
  const board = draft ?? resolveBoard(app);
  const photos = visibleHomePhotos(board, app);
  const dirty = draft !== null && JSON.stringify(draft) !== JSON.stringify(resolveBoard(app));
  const show = (id: BoardTab) => !tabbed || tab === id;
  const tabs: { id: BoardTab; label: string; icon: typeof Plus; count?: number }[] = [
    { id: "notices", label: "מודעות", icon: Megaphone, count: board.notices.length },
    { id: "prayers", label: "זמני תפילה", icon: Calendar, count: board.prayers.length },
    { id: "files", label: "דפי לימוד", icon: FileText, count: board.files.length },
    { id: "poll", label: "סקר", icon: Vote },
    { id: "photos", label: "תמונות", icon: ImageIcon, count: photos.length },
  ];

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
    <div className={cn(PANEL, tabbed ? "overflow-clip" : "mb-4")}>
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

      {tabbed ? (
        <div className="border-t border-[#e9ecef] px-3 pt-3 md:px-4">
          <div
            role="tablist"
            aria-label="חלקי הלוח"
            className="flex gap-1 overflow-x-auto rounded-full bg-[#eef0f3] p-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
          >
            {tabs.map((item) => (
              <button
                key={item.id}
                type="button"
                role="tab"
                aria-selected={tab === item.id}
                onClick={() => setTab(item.id)}
                className={cn(
                  "flex min-w-fit flex-1 items-center justify-center gap-1.5 rounded-full px-3 py-2 text-[13.5px] transition-colors",
                  tab === item.id
                    ? "bg-white text-foreground shadow-[0_1px_3px_rgba(16,24,40,0.12)]"
                    : "text-muted-foreground hover:text-foreground"
                )}
              >
                <item.icon className="hidden size-4 sm:block" />
                {item.label}
                {item.count ? <span className="text-[#9aa1ab] tabular-nums">{item.count}</span> : null}
              </button>
            ))}
          </div>
        </div>
      ) : null}

      <div className={cn("grid gap-5 px-4 py-4 md:px-5", !tabbed && "border-t border-[#e9ecef]")}>
        {show("notices") ? (
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
              disabled={noticeBusy || uploading || photoBusy || saving}
              onClick={() => noticeRef.current?.click()}
              className="inline-flex w-fit items-center gap-1 text-[13px] text-primary"
            >
              <Plus className="size-3.5" />
              {noticeBusy ? "מעלה…" : "העלאת תמונת מודעה"}
            </button>
          ) : null}
        </Field>
        ) : null}

        {show("prayers") ? (
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
        ) : null}

        {show("files") ? (
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
              disabled={uploading || noticeBusy || photoBusy || saving}
              onClick={() => fileRef.current?.click()}
              className="inline-flex w-fit items-center gap-1 text-[13px] text-primary"
            >
              <Plus className="size-3.5" />
              {uploading ? "מעלה…" : "העלאת PDF"}
            </button>
          ) : null}
        </Field>
        ) : null}

        {show("poll") ? (
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
        ) : null}

        {show("photos") ? (
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
              disabled={photoBusy || uploading || noticeBusy || saving}
              onClick={() => photoRef.current?.click()}
              className="inline-flex w-fit items-center gap-1 text-[13px] text-primary"
            >
              <Plus className="size-3.5" />
              {photoBusy ? "מעלה…" : "העלאת תמונה"}
            </button>
          ) : null}
        </Field>
        ) : null}

        {tabbed ? null : (
          <Button
            type="button"
            disabled={saving}
            className="h-10 w-fit rounded-full px-5"
            onClick={() => void save(board, "הלוח נשמר")}
          >
            שמירת הלוח
          </Button>
        )}
      </div>
      {tabbed && dirty ? (
        <div className="sticky bottom-20 z-10 mx-3 mb-3 flex items-center justify-between gap-3 rounded-full border border-[#e2d3b5] bg-[#fbf6ec] py-2 pe-2 ps-5 text-sm md:bottom-4 md:mx-4">
          יש שינויים שעוד לא נשמרו
          <div className="flex gap-1.5">
            <Button type="button" variant="ghost" className="rounded-full" disabled={saving} onClick={() => setDraft(null)}>
              ביטול
            </Button>
            <Button type="button" className="rounded-full px-5" disabled={saving} onClick={() => void save(board, "הלוח נשמר")}>
              {saving ? "שומר…" : "שמירת הלוח"}
            </Button>
          </div>
        </div>
      ) : null}
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
