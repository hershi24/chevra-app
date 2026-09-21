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
import { Textarea } from "@/components/ui/textarea";
import { useApp } from "@/components/app-provider";
import type { Member } from "@/lib/types";

export function EventDialog({
  trigger,
  onCreated,
}: {
  trigger: React.ReactNode;
  onCreated?: () => void;
}) {
  const { state, act } = useApp();
  const members = state?.members ?? [];
  const [open, setOpen] = useState(false);
  const [saving, setSaving] = useState(false);

  async function onSubmit(formData: FormData) {
    setSaving(true);
    try {
      const date = String(formData.get("date"));
      const time = String(formData.get("time"));
      const startsAt = new Date(`${date}T${time}`).toISOString();
      await act({
        type: "createEvent",
        title: String(formData.get("title")),
        startsAt,
        location: String(formData.get("location")),
        hostId: String(formData.get("hostId")),
        kibudId: String(formData.get("kibudId") || "") || undefined,
        lecturerId: String(formData.get("lecturerId") || "") || undefined,
        topic: String(formData.get("topic") || "") || undefined,
        notes: String(formData.get("notes") || "") || undefined,
      });
      toast.success("המפגש נקבע");
      setOpen(false);
      onCreated?.();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "שמירה נכשלה");
    } finally {
      setSaving(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>{trigger}</DialogTrigger>
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>קביעת מפגש חדש</DialogTitle>
        </DialogHeader>
        <form action={onSubmit} className="grid gap-3">
          <Field label="כותרת" name="title" defaultValue="חברותא · מפגש החבורה" required />
          <div className="grid grid-cols-2 gap-3">
            <Field label="תאריך" name="date" type="date" required />
            <Field label="שעה" name="time" type="time" defaultValue="20:30" required />
          </div>
          <Field label="מיקום / מארח" name="location" placeholder="כתובת או שם הבית" required />
          <SelectField label="מארח" name="hostId" members={members} />
          <SelectField label="אחראי כיבוד" name="kibudId" members={members} optional />
          <SelectField label="מגיד השיעור" name="lecturerId" members={members} optional />
          <Field label="נושא השיעור" name="topic" />
          <div className="grid gap-1.5">
            <Label htmlFor="notes">הערות</Label>
            <Textarea id="notes" name="notes" rows={3} />
          </div>
          <Button type="submit" disabled={saving} className="mt-2">
            {saving ? "שומר…" : "שמירת מפגש"}
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
}: {
  label: string;
  name: string;
  members: Member[];
  optional?: boolean;
}) {
  return (
    <div className="grid gap-1.5">
      <Label htmlFor={name}>{label}</Label>
      <select
        id={name}
        name={name}
        className="h-8 rounded-lg border border-input bg-transparent px-2.5 text-sm"
        defaultValue={optional ? "" : members[0]?.id}
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
