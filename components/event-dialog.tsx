"use client";

import { useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { useApp } from "@/components/app-provider";
import { formatHebrewDate } from "@/lib/format";
import type { Gathering, Member } from "@/lib/types";
import { cn } from "@/lib/utils";

const STATUSES: { id: Gathering["status"]; label: string; hint: string }[] = [
  { id: "upcoming", label: "קרובה", hint: "מופיעה כחברה הבאה, ואפשר לשלוח הזמנות." },
  { id: "past", label: "התקיימה", hint: "עוברת ליומן החברות שעברו." },
  { id: "cancelled", label: "בוטלה", hint: "יורדת מהחברה הקרובה. האישורים של החברים נשמרים." },
];

function pad(value: number) {
  return String(value).padStart(2, "0");
}

function dateValue(iso?: string) {
  const date = iso ? new Date(iso) : new Date();
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
}

function timeValue(iso?: string) {
  const date = iso ? new Date(iso) : new Date();
  if (!iso) return "20:30";
  return `${pad(date.getHours())}:${pad(date.getMinutes())}`;
}

export function EventDialog({
  trigger,
  event,
  onCreated,
}: {
  trigger: React.ReactNode;
  event?: Gathering;
  onCreated?: () => void;
}) {
  const { state, act } = useApp();
  const members = state?.members ?? [];
  const [open, setOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [withTitle, setWithTitle] = useState(Boolean(event?.title?.trim()));
  const [date, setDate] = useState(dateValue(event?.startsAt));
  const [time, setTime] = useState(timeValue(event?.startsAt));
  const [status, setStatus] = useState<Gathering["status"]>(event?.status ?? "upcoming");
  const [notify, setNotify] = useState(false);
  const [cancelNote, setCancelNote] = useState("");
  const [openedAt, setOpenedAt] = useState(0);

  async function onSubmit(formData: FormData) {
    setSaving(true);
    try {
      const startsAt = new Date(`${date}T${time}`).toISOString();
      const title = withTitle ? String(formData.get("title") ?? "").trim() : "";
      const hostId = String(formData.get("hostId"));
      const kibudId = String(formData.get("kibudId") || "") || undefined;
      const topic = String(formData.get("topic") || "") || undefined;
      const notes = String(formData.get("notes") || "") || undefined;
      if (event) {
        await act({
          type: "updateEvent",
          eventId: event.id,
          patch: { title, startsAt, hostId, kibudId, topic, notes, status },
        });
        if (status === "cancelled" && notify) {
          const res = await fetch("/api/invitations", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ eventId: event.id, note: cancelNote, variant: "cancel" }),
          });
          const data = (await res.json()) as { error?: string; sentCount?: number; failedCount?: number };
          if (!res.ok) toast.error(data.error || "הודעת הביטול לא נשלחה");
          else if (data.sentCount && !data.failedCount) toast.success(`החברה סווגה כבוטלה · נשלחו ${data.sentCount} הודעות`);
          else if (data.sentCount) toast.success(`החברה סווגה כבוטלה · נשלחו ${data.sentCount}, נכשלו ${data.failedCount}`);
          else toast.error("החברה סווגה כבוטלה, אבל אף הודעת ביטול לא יצאה");
        } else {
          toast.success(status === "cancelled" ? "החברה סווגה כבוטלה" : "החברה עודכנה");
        }
      } else {
        await act({
          type: "createEvent",
          title,
          startsAt,
          hostId,
          kibudId,
          topic,
          notes,
        });
        toast.success("החברה נקבעה");
      }
      setOpen(false);
      if (!event) setWithTitle(false);
      onCreated?.();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "שמירה נכשלה");
    } finally {
      setSaving(false);
    }
  }

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        setOpen(next);
        if (next && event) {
          setStatus(event.status);
          setNotify(false);
          setCancelNote("");
          setOpenedAt(Date.now());
        }
        if (!next && !event) setWithTitle(false);
      }}
    >
      <DialogTrigger asChild>{trigger}</DialogTrigger>
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>{event ? "עריכת חברה" : "קביעת חברה חדשה"}</DialogTitle>
        </DialogHeader>
        <form action={onSubmit} className="grid gap-3">
          <div className="flex items-center justify-between gap-3 rounded-xl bg-muted/60 px-3 py-2.5">
            <div>
              <Label htmlFor="withTitle" className="text-sm font-normal">
                כותרת לחברה
              </Label>
              <p className="text-[12px] font-light text-muted-foreground">
                אם מכבים — החברה תוצג לפי תאריך ונושא בלבד.
              </p>
            </div>
            <Switch
              id="withTitle"
              checked={withTitle}
              onCheckedChange={setWithTitle}
            />
          </div>
          {withTitle ? (
            <Field
              label="כותרת"
              name="title"
              placeholder="למשל: חברותא · פרשת השבוע"
              defaultValue={event?.title}
            />
          ) : null}
          <div className="grid grid-cols-2 gap-3">
            <Field
              label="תאריך"
              name="date"
              type="date"
              required
              value={date}
              onChange={(e) => setDate(e.target.value)}
            />
            <Field
              label="שעה"
              name="time"
              type="time"
              required
              value={time}
              onChange={(e) => setTime(e.target.value)}
            />
          </div>
          {date ? (
            <p className="rounded-xl bg-muted/60 px-3 py-2 text-sm font-light leading-6">
              <span className="block">{new Date(`${date}T${time || "00:00"}`).toLocaleDateString("he-IL", { weekday: "long", day: "numeric", month: "long", year: "numeric" })}</span>
              <span className="block text-muted-foreground">{formatHebrewDate(`${date}T${time || "00:00"}`)}</span>
            </p>
          ) : null}
          <SelectField label="מארח" name="hostId" members={members} defaultValue={event?.hostId} />
          <SelectField
            label="אחראי כיבוד"
            name="kibudId"
            members={members}
            optional
            defaultValue={event?.kibudId}
          />
          <Field label="נושא השיעור" name="topic" defaultValue={event?.topic} />
          <div className="grid gap-1.5">
            <Label htmlFor="notes">הערות</Label>
            <Textarea id="notes" name="notes" rows={3} defaultValue={event?.notes} />
          </div>
          {event ? (
            <div className="grid gap-2">
              <Label>סיווג החברה</Label>
              <div className="grid grid-cols-3 gap-1.5">
                {STATUSES.map((item) => (
                  <button
                    key={item.id}
                    type="button"
                    aria-pressed={status === item.id}
                    onClick={() => {
                      setStatus(item.id);
                      if (item.id !== "cancelled") setNotify(false);
                      else if (event.status !== "cancelled") setNotify(true);
                    }}
                    className={cn(
                      "rounded-full border px-2 py-2 text-[13px]",
                      status === item.id
                        ? item.id === "cancelled"
                          ? "border-[#a4453a] bg-[#fdf3ef] text-[#a4453a]"
                          : "border-[#a9782c] bg-[#f5f0e7] text-[#7d5a22]"
                        : "border-[#dfe3e8] text-foreground/75"
                    )}
                  >
                    {item.id === "cancelled" ? "✕ בוטלה" : item.label}
                  </button>
                ))}
              </div>
              <p className="text-[12px] font-light leading-5 text-muted-foreground">
                {STATUSES.find((item) => item.id === status)?.hint}
                {status === "upcoming" && openedAt > 0 && new Date(`${date}T${time}`).getTime() < openedAt
                  ? " התאריך כבר עבר, אז אפשר לסווג אותה כחברה שהתקיימה או כבוטלה."
                  : ""}
              </p>
            </div>
          ) : null}
          {event && status === "cancelled" ? (
            <div className="grid gap-2 rounded-xl bg-[#fdf3ef] px-3 py-3">
              <label className="flex items-center justify-between gap-3 text-sm">
                שליחת הודעת ביטול לחברים
                <Switch checked={notify} onCheckedChange={setNotify} />
              </label>
              <p className="text-[12px] font-light leading-5 text-muted-foreground">
                המייל יוצא עם הכותרת ״✕ בוטלה״ וסימון ברור שהחברה לא תתקיים. בלי כפתורי הגעה ובלי סטטוס של חברים.
              </p>
              {notify ? (
                <Textarea
                  rows={2}
                  value={cancelNote}
                  onChange={(e) => setCancelNote(e.target.value)}
                  placeholder="מילה קצרה שתופיע בהודעה (לא חובה)"
                  className="bg-white"
                />
              ) : null}
            </div>
          ) : null}
          <Button type="submit" disabled={saving} className="mt-2">
            {saving ? "שומר…" : event ? "שמירת שינויים" : "שמירת חברה"}
          </Button>
        </form>
      </DialogContent>
    </Dialog>
  );
}

function Field({
  label,
  name,
  ...props
}: React.ComponentProps<typeof Input> & { label: string; name: string }) {
  return (
    <div className="grid gap-1.5">
      <Label htmlFor={name}>{label}</Label>
      <Input id={name} name={name} {...props} />
    </div>
  );
}

function SelectField({
  label,
  name,
  members,
  optional,
  defaultValue,
}: {
  label: string;
  name: string;
  members: Member[];
  optional?: boolean;
  defaultValue?: string;
}) {
  return (
    <div className="grid gap-1.5">
      <Label htmlFor={name}>{label}</Label>
      <select
        id={name}
        name={name}
        className="h-8 rounded-lg border border-input bg-transparent px-2.5 text-sm"
        defaultValue={defaultValue || (optional ? "" : members[0]?.id)}
      >
        {optional ? <option value="">ללא</option> : null}
        {members.map((member) => (
          <option key={member.id} value={member.id}>
            {member.displayName}
          </option>
        ))}
      </select>
    </div>
  );
}
