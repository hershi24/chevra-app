"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { formatDateTimeHe, gatheringLabel } from "@/lib/format";
import type { Gathering, Member, RsvpStatus } from "@/lib/types";

export function RsvpView({
  token,
  initial,
  initialError,
}: {
  token: string;
  initial: { status: RsvpStatus; event: Gathering; member: Member } | null;
  initialError: string | null;
}) {
  const [status, setStatus] = useState<"loading" | "done" | "error">(
    initial || initialError ? (initial ? "done" : "error") : "loading"
  );
  const [result, setResult] = useState<RsvpStatus | null>(initial?.status ?? null);
  const [event, setEvent] = useState<Gathering | null>(initial?.event ?? null);
  const [member, setMember] = useState<Member | null>(initial?.member ?? null);
  const [error, setError] = useState<string | null>(initialError);
  const [saved, setSaved] = useState(Boolean(initial));

  useEffect(() => {
    if (initial || initialError) return;
    async function run() {
      try {
        const res = await fetch(`/api/rsvp/${token}`);
        const data = await res.json();
        if (!res.ok) throw new Error(data.error);
        setEvent(data.event);
        setMember(data.member);
        setResult(data.status);
        setStatus("done");
      } catch (err) {
        setError(err instanceof Error ? err.message : "קישור לא תקין");
        setStatus("error");
      }
    }
    void run();
  }, [token, initial, initialError]);

  async function pick(next: RsvpStatus) {
    const res = await fetch(`/api/rsvp/${token}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ choice: next }),
    });
    const data = await res.json();
    if (!res.ok) {
      setError(data.error);
      return;
    }
    setResult(data.status);
    setEvent(data.event);
    setSaved(true);
    setStatus("done");
  }

  return (
    <div className="flex min-h-dvh items-center justify-center bg-white px-4">
      <div className="paper-card w-full max-w-md rounded-3xl p-6">
        <p className="text-sm text-primary">מיין חברה</p>
        <h1 className="font-heading mt-1 text-2xl font-semibold">אישור הגעה</h1>
        {status === "loading" ? <p className="mt-4 text-muted-foreground">מעדכן…</p> : null}
        {status === "error" ? <p className="mt-4 text-destructive">{error}</p> : null}
        {status === "done" && event && member ? (
          <div className="mt-4 space-y-4">
            <p>
              שלום {member.displayName}, החברה <strong>{gatheringLabel(event)}</strong> תתקיים ב
              {formatDateTimeHe(event.startsAt)}.
            </p>
            <p className="text-sm text-muted-foreground">{event.location}</p>
            <p className="rounded-xl bg-secondary px-3 py-2 text-sm">
              {saved ? "ההגעה עודכנה. " : ""}
              הסטטוס שלך:{" "}
              {result === "yes" ? "מגיע" : result === "no" ? "לא מגיע" : result === "maybe" ? "אולי" : "טרם השיב"}
            </p>
            <div className="flex flex-wrap gap-2">
              <Button onClick={() => void pick("yes")}>מאשר הגעה</Button>
              <Button variant="outline" onClick={() => void pick("no")}>
                לא אוכל להגיע
              </Button>
            </div>
            <Link href="/login" className="block text-sm text-primary underline">
              כניסה לאפליקציה
            </Link>
          </div>
        ) : null}
      </div>
    </div>
  );
}
