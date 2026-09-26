"use client";

import { useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useApp } from "@/components/app-provider";

export function PollDialog({
  channelId,
  open,
  onOpenChange,
}: {
  channelId: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const { act } = useApp();
  const [question, setQuestion] = useState("");
  const [options, setOptions] = useState(["", ""]);
  const [saving, setSaving] = useState(false);

  function reset() {
    setQuestion("");
    setOptions(["", ""]);
  }

  async function submit() {
    setSaving(true);
    try {
      await act({ type: "createPoll", channelId, question, options });
      reset();
      onOpenChange(false);
      toast.success("הסקר נפתח");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "פתיחת הסקר נכשלה");
    } finally {
      setSaving(false);
    }
  }

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        if (!next) reset();
        onOpenChange(next);
      }}
    >
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>סקר חדש</DialogTitle>
        </DialogHeader>
        <div className="grid gap-3">
          <div className="grid gap-1.5">
            <Label htmlFor="poll-question">שאלה</Label>
            <Input
              id="poll-question"
              value={question}
              onChange={(event) => setQuestion(event.target.value)}
              placeholder="איפה החברה הבאה?"
            />
          </div>
          <div className="grid gap-2">
            <Label>אפשרויות</Label>
            {options.map((option, index) => (
              <div key={index} className="flex gap-2">
                <Input
                  value={option}
                  onChange={(event) =>
                    setOptions((current) => current.map((item, i) => (i === index ? event.target.value : item)))
                  }
                  placeholder={index === 0 ? "אצלי" : "אצל משה"}
                />
                {options.length > 2 ? (
                  <Button
                    type="button"
                    variant="ghost"
                    onClick={() => setOptions((current) => current.filter((_, i) => i !== index))}
                  >
                    הסרה
                  </Button>
                ) : null}
              </div>
            ))}
            {options.length < 6 ? (
              <Button type="button" variant="outline" onClick={() => setOptions((current) => [...current, ""])}>
                אפשרות נוספת
              </Button>
            ) : null}
          </div>
          <Button type="button" disabled={saving} onClick={() => void submit()}>
            {saving ? "פותח…" : "פתיחת הסקר"}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
