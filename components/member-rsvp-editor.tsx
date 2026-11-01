"use client";

import { useState } from "react";
import { toast } from "sonner";
import { useApp } from "@/components/app-provider";
import { rsvpLabel } from "@/lib/format";
import type { RsvpStatus } from "@/lib/types";
import { cn } from "@/lib/utils";

const CHOICES: { status: RsvpStatus; label: string }[] = [
  { status: "yes", label: "מגיע" },
  { status: "maybe", label: "אולי" },
  { status: "no", label: "לא מגיע" },
  { status: "pending", label: "טרם השיב" },
];

export function MemberRsvpEditor({
  eventId,
  memberId,
  status,
  className,
}: {
  eventId: string;
  memberId: string;
  status: RsvpStatus;
  className?: string;
}) {
  const { act } = useApp();
  const [busy, setBusy] = useState(false);

  async function choose(next: RsvpStatus) {
    if (next === status || busy) return;
    setBusy(true);
    try {
      await act({ type: "setMemberRsvp", eventId, memberId, status: next });
      toast.success(next === "pending" ? "התשובה נוקתה" : `עודכן: ${rsvpLabel(next)}`);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "השמירה נכשלה");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div role="group" aria-label="עדכון הגעה" className={cn("flex flex-wrap gap-1", className)}>
      {CHOICES.map((choice) => {
        const active = status === choice.status;
        return (
          <button
            key={choice.status}
            type="button"
            aria-pressed={active}
            disabled={busy}
            onClick={() => void choose(choice.status)}
            className={cn(
              "whitespace-nowrap rounded-full px-2 py-0.5 text-[11px] disabled:opacity-50",
              active && choice.status === "yes" && "bg-[#e6f2ea] text-[#3d8f62]",
              active && choice.status === "maybe" && "bg-[#f5f0e7] text-primary",
              active && choice.status === "no" && "bg-[#f3ecec] text-[#8a5a55]",
              active && choice.status === "pending" && "bg-[#f1f3f6] text-[#6b7280]",
              !active && "bg-white text-muted-foreground ring-1 ring-[#e6e9ee] hover:text-foreground"
            )}
          >
            {choice.label}
          </button>
        );
      })}
    </div>
  );
}
