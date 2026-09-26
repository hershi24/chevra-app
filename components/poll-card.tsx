"use client";

import { useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { pollVoters } from "@/lib/poll";
import { isLeader } from "@/lib/permissions";
import type { Member, Poll } from "@/lib/types";
import { cn } from "@/lib/utils";

export function PollCard({
  messageId,
  poll,
  me,
  members,
  onVote,
}: {
  messageId: string;
  poll: Poll;
  me: Member;
  members: Member[];
  onVote: (optionId: string) => Promise<void>;
}) {
  const [thanks, setThanks] = useState(false);
  const [busy, setBusy] = useState<"close" | "notify" | null>(null);
  const total = poll.options.reduce((sum, option) => sum + option.voterIds.length, 0);
  const manage = isLeader(me);
  const mine = poll.options.find((option) => option.voterIds.includes(me.id))?.id;

  async function choose(optionId: string) {
    if (poll.closed || mine === optionId) return;
    setThanks(true);
    window.setTimeout(() => setThanks(false), 2200);
    try {
      await onVote(optionId);
    } catch (error) {
      setThanks(false);
      toast.error(error instanceof Error ? error.message : "ההצבעה נכשלה");
    }
  }

  async function managePoll(action: "close" | "notify") {
    setBusy(action);
    try {
      const res = await fetch("/api/polls", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ messageId, action }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "הפעולה נכשלה");
      if (action === "close") {
        toast.success(
          data.sent ? `הסקר נסגר. תוצאות נשלחו אל ${data.sent}` : "הסקר נסגר"
        );
      } else {
        toast.success(data.sent ? `התראה נשלחה אל ${data.sent}` : "אף מייל לא נשלח");
      }
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "הפעולה נכשלה");
    } finally {
      setBusy(null);
    }
  }

  return (
    <>
      <div className="rounded-2xl rounded-ss-md bg-white px-3 py-3 text-sm leading-6 text-foreground shadow-sm ring-1 ring-black/[0.08]">
        <div className="mb-2 flex items-baseline justify-between gap-3">
          <div className="font-medium">{poll.question}</div>
          <div className="shrink-0 text-[11px] text-muted-foreground">{total} הצביעו</div>
        </div>
        <div className="space-y-1.5">
          {poll.options.map((option) => {
            const selected = option.id === mine;
            const width = total ? Math.round((option.voterIds.length / total) * 100) : 0;
            const names = pollVoters(members, option.voterIds);
            return (
              <div key={option.id}>
                <button
                  type="button"
                  disabled={poll.closed}
                  onClick={() => void choose(option.id)}
                  className={cn(
                    "relative w-full overflow-hidden rounded-xl bg-[#f3f4f6] text-start disabled:cursor-default",
                    selected && "shadow-[inset_0_0_0_1.5px_#3f4650]"
                  )}
                >
                  <span
                    className={cn("absolute inset-y-0 start-0", selected ? "bg-[#e5e7eb]" : "bg-[#eceef1]")}
                    style={{ width: `${width}%` }}
                  />
                  <span className="relative flex items-center justify-between gap-2 px-2.5 py-2">
                    <span className="flex items-center gap-2">
                      <span
                        className={cn(
                          "flex size-4 items-center justify-center rounded-full border text-[10px] text-white",
                          selected ? "border-primary bg-primary" : "border-[#9ca3af] bg-white"
                        )}
                      >
                        {selected ? "✓" : ""}
                      </span>
                      {option.label}
                    </span>
                    <span className="text-xs text-muted-foreground">{option.voterIds.length}</span>
                  </span>
                </button>
                {manage ? (
                  <div className="mt-0.5 ps-7 text-[11px] text-muted-foreground">
                    {names.length ? names.join(", ") : "אין מצביעים"}
                  </div>
                ) : null}
              </div>
            );
          })}
        </div>
        <p className="mt-2.5 text-[11px] text-muted-foreground">
          {poll.closed ? "הסקר נסגר" : "אפשר להחליף הצבעה עד שהסקר נסגר"}
        </p>
        {manage && !poll.closed ? (
          <div className="mt-2 flex flex-wrap gap-2">
            <Button type="button" size="xs" variant="outline" disabled={busy !== null} onClick={() => void managePoll("notify")}>
              {busy === "notify" ? "שולח…" : "שליחת התראה"}
            </Button>
            <Button type="button" size="xs" variant="outline" disabled={busy !== null} onClick={() => void managePoll("close")}>
              {busy === "close" ? "סוגר…" : "סיום הסקר"}
            </Button>
          </div>
        ) : null}
      </div>
      {thanks ? (
        <div className="pointer-events-none fixed inset-0 z-[70] flex items-center justify-center px-6">
          <div className="rounded-3xl bg-white px-8 py-6 text-center shadow-[0_18px_50px_rgba(31,35,40,0.16)] ring-1 ring-black/10">
            <div className="mx-auto flex size-11 items-center justify-center rounded-full bg-primary text-lg text-primary-foreground">
              ✓
            </div>
            <p className="mt-3 text-2xl font-medium">עזרת לנו מאוד!!</p>
          </div>
        </div>
      ) : null}
    </>
  );
}
