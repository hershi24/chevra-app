"use client";

import { useRef, useState } from "react";
import { toast } from "sonner";
import { useApp } from "@/components/app-provider";
import { MediaProgressOverlay } from "@/components/media-progress";
import { MemberAdmin, MemberDirectory } from "@/components/member-admin";
import { UserAvatar } from "@/components/user-avatar";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { formatDateTimeHe, memberById, roleLabel } from "@/lib/format";
import { can, isAdmin } from "@/lib/permissions";
import { upcomingGathering } from "@/lib/selectors";
import type { EmailDelivery, Member } from "@/lib/types";
import { createLocalUpload, preloadMedia, uploadWithProgress } from "@/lib/upload-client";
import { cn } from "@/lib/utils";

export function SettingsView() {
  const { state, me, act, logout, onlineIds } = useApp();
  const fileRef = useRef<HTMLInputElement>(null);
  const [sending, setSending] = useState(false);
  const [inviteNote, setInviteNote] = useState("");
  const [deliveries, setDeliveries] = useState<EmailDelivery[] | null>(null);
  const [pendingBg, setPendingBg] = useState<{
    previewUrl: string;
    progress: number;
    remainingSeconds: number | null;
  } | null>(null);

  if (!state || !me) return null;
  const user = me;
  const event = upcomingGathering(state);

  async function sendInvites() {
    if (!event || sending) return;
    setSending(true);
    try {
      const res = await fetch("/api/invitations", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ eventId: event.id, note: inviteNote }),
      });
      const data = await res.json();
      if (!res.ok) {
        toast.error(data.error || "שליחה נכשלה");
        return;
      }
      setDeliveries(data.deliveries ?? []);
      if (data.sentCount && !data.failedCount) toast.success(`נשלחו ${data.sentCount} הזמנות`);
      else if (data.sentCount) toast.success(`נשלחו ${data.sentCount}, נכשלו ${data.failedCount}`);
      else toast.error("אף מייל לא נשלח");
    } finally {
      setSending(false);
    }
  }

  async function pingIvr() {
    const res = await fetch("/api/ivr", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        phone: user.phone,
        digits: "1",
        action: "tzintuk",
        eventId: event?.id,
      }),
    });
    const data = await res.json();
    if (!res.ok) {
      toast.error(data.error || "IVR נכשל");
      return;
    }
    toast.success("צילצול / עדכון IVR נרשם");
  }

  return (
    <div className="mx-auto max-w-5xl space-y-8">
      <div>
        <p className="text-[13px] font-light text-muted-foreground">
          {can(me, "manageMembers") ? "ניהול חברים, הרשאות והזמנות" : "החשבון, החברים והאווירה"}
        </p>
        <h1 className="mt-1 text-[1.65rem] font-medium tracking-tight md:text-[2rem]">הגדרות</h1>
      </div>

      <Card className="paper-card rounded-[1.75rem]">
        <CardHeader>
          <CardTitle>החשבון שלי</CardTitle>
        </CardHeader>
        <CardContent className="flex items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <UserAvatar member={me} size="lg" />
            <div>
              <div className="font-medium">{me.displayName}</div>
              <div className="text-sm text-muted-foreground">
                שם משתמש: {me.username} · {roleLabel(me.role)}
              </div>
            </div>
          </div>
          <Button variant="outline" onClick={() => void logout()}>
            יציאה
          </Button>
        </CardContent>
      </Card>

      <PasswordCard />

      {isAdmin(me) ? <OnlineNow members={state.members} onlineIds={onlineIds} /> : null}

      {can(me, "manageMembers") ? (
        <Card className="paper-card rounded-[1.75rem]">
          <CardHeader>
            <CardTitle className="font-medium">ניהול חברים והרשאות</CardTitle>
          </CardHeader>
          <CardContent>
            <MemberAdmin />
          </CardContent>
        </Card>
      ) : (
        <Card className="paper-card rounded-[1.75rem]">
          <CardHeader>
            <CardTitle className="font-medium">חברי החבורה</CardTitle>
          </CardHeader>
          <CardContent>
            <MemberDirectory members={state.members} />
          </CardContent>
        </Card>
      )}

      {can(me, "uploadBackground") ? (
        <Card className="paper-card rounded-[1.75rem]">
          <CardHeader>
            <CardTitle className="font-medium">אווירת החדר</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <p className="text-[13px] font-light text-muted-foreground">
              מסך האתר לבן. תמונה מחברה קודמת נשמרת כאן ולא נצבעת על הרקע.
            </p>
            <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
              {state.settings.backgrounds.map((bg) => (
                <button
                  key={bg.id}
                  onClick={() => void act({ type: "setBackground", backgroundImageId: bg.id })}
                  className={cn(
                    "overflow-hidden rounded-xl ring-2 ring-transparent",
                    state.settings.backgroundImageId === bg.id && "ring-primary"
                  )}
                >
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={bg.url} alt={bg.label} className="aspect-[4/3] w-full object-cover" />
                  <div className="bg-white px-2 py-1.5 text-start text-[11px]">{bg.label}</div>
                </button>
              ))}
              {pendingBg ? (
                <div className="overflow-hidden rounded-xl ring-2 ring-primary">
                  <MediaProgressOverlay
                    src={pendingBg.previewUrl}
                    type="image"
                    progress={pendingBg.progress}
                    remainingSeconds={pendingBg.remainingSeconds}
                    mediaClassName="aspect-[4/3] max-h-none"
                  />
                  <div className="bg-white px-2 py-1.5 text-start text-[11px]">מעלה…</div>
                </div>
              ) : null}
            </div>
            <input
              ref={fileRef}
              type="file"
              accept="image/*"
              className="hidden"
              onChange={async (e) => {
                const file = e.target.files?.[0];
                if (!file) return;
                const local = createLocalUpload(file);
                setPendingBg({
                  previewUrl: local.previewUrl,
                  progress: 0,
                  remainingSeconds: null,
                });
                if (fileRef.current) fileRef.current.value = "";
                try {
                  const data = await uploadWithProgress(file, {}, ({ percent, remainingSeconds }) => {
                    setPendingBg((prev) =>
                      prev ? { ...prev, progress: percent, remainingSeconds } : prev
                    );
                  });
                  await preloadMedia(data.url, "image");
                  await act({
                    type: "addBackground",
                    url: data.url,
                    label: file.name.replace(/\.[^.]+$/, ""),
                  });
                  toast.success("הרקע נוסף");
                } catch {
                  toast.error("העלאה נכשלה");
                } finally {
                  URL.revokeObjectURL(local.previewUrl);
                  setPendingBg(null);
                }
              }}
            />
            <Button variant="outline" onClick={() => fileRef.current?.click()}>
              העלאת תמונה מחברה קודמת
            </Button>
          </CardContent>
        </Card>
      ) : null}

      {can(me, "sendInvites") ? (
        <Card className="paper-card rounded-[1.75rem]">
          <CardHeader>
            <CardTitle className="font-medium">הזמנות במייל · לחיצה אחת</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <p className="text-sm text-muted-foreground">
              שליחת HTML עם כפתורי [מאשר הגעה] / [אולי] / [לא אוכל להגיע]. כל קישור מעדכן את היומן בלי התחברות.
              בלי מפתח Resend ההזמנות נשמרות כאן עם קישורים לבדיקה.
            </p>
            <div className="grid gap-2">
              <Label htmlFor="invite-note">הודעה אישית למייל</Label>
              <Textarea
                id="invite-note"
                rows={4}
                value={inviteNote}
                onChange={(e) => setInviteNote(e.target.value)}
                placeholder="אפשר לכתוב כאן משהו שיופיע בכל הזמנה. אם משאירים ריק, נשלחת ההזמנה בלי תוספת."
              />
            </div>
            <div className="flex flex-wrap gap-2">
              <Button onClick={() => void sendInvites()} disabled={!event || sending}>
                {sending ? "שולח…" : "שליחת הזמנות לחברה הקרובה"}
              </Button>
              {can(me, "triggerIvr") ? (
                <Button variant="outline" onClick={() => void pingIvr()}>
                  צילצול / IVR
                </Button>
              ) : null}
            </div>
            <InviteReport
              deliveries={deliveries ?? state.emailLog.find((entry) => entry.eventId === event?.id)?.deliveries ?? null}
              sentAt={deliveries ? null : state.emailLog.find((entry) => entry.eventId === event?.id)?.sentAt}
            />
            {state.ivrLog[0] ? (
              <p className="text-xs text-muted-foreground">
                IVR אחרון: {state.ivrLog[0].result} · {state.ivrLog[0].phone}
              </p>
            ) : null}
          </CardContent>
        </Card>
      ) : null}
    </div>
  );
}

function PasswordCard() {
  const { act } = useApp();
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [saving, setSaving] = useState(false);

  return (
    <Card id="password" className="paper-card scroll-mt-24 rounded-[1.75rem]">
      <CardHeader>
        <CardTitle className="font-medium">החלפת סיסמה</CardTitle>
      </CardHeader>
      <CardContent>
        <form
          className="grid max-w-md gap-3"
          onSubmit={async (e) => {
            e.preventDefault();
            setSaving(true);
            try {
              await act({ type: "changePassword", currentPassword, newPassword });
              setCurrentPassword("");
              setNewPassword("");
              toast.success("הסיסמה הוחלפה");
            } catch (error) {
              toast.error(error instanceof Error ? error.message : "ההחלפה נכשלה");
            } finally {
              setSaving(false);
            }
          }}
        >
          <div className="grid gap-1.5">
            <Label htmlFor="current-password">סיסמה נוכחית</Label>
            <Input
              id="current-password"
              type="password"
              autoComplete="current-password"
              value={currentPassword}
              onChange={(e) => setCurrentPassword(e.target.value)}
              required
            />
          </div>
          <div className="grid gap-1.5">
            <Label htmlFor="new-password">סיסמה חדשה</Label>
            <Input
              id="new-password"
              type="password"
              autoComplete="new-password"
              value={newPassword}
              onChange={(e) => setNewPassword(e.target.value)}
              required
            />
          </div>
          <Button type="submit" disabled={saving}>
            {saving ? "שומר…" : "החלפת הסיסמה"}
          </Button>
        </form>
      </CardContent>
    </Card>
  );
}

function InviteReport({
  deliveries,
  sentAt,
}: {
  deliveries: EmailDelivery[] | null;
  sentAt?: string | null;
}) {
  if (!deliveries?.length) return null;
  const sent = deliveries.filter((row) => row.status === "sent").length;
  const failed = deliveries.filter((row) => row.status === "failed").length;
  const skipped = deliveries.filter((row) => row.status === "skipped").length;
  return (
    <div className="rounded-xl bg-secondary p-3 text-sm">
      <p className="font-medium">
        {sent} נשלחו
        {failed ? ` · ${failed} נכשלו` : ""}
        {skipped ? ` · ${skipped} לא נשלחו` : ""}
      </p>
      {sentAt ? (
        <p className="mt-1 text-xs text-muted-foreground">שליחה אחרונה: {formatDateTimeHe(sentAt)}</p>
      ) : null}
      <ul className="mt-2 space-y-1">
        {deliveries.map((row) => (
          <li key={`${row.name}-${row.to}`} className="flex flex-wrap items-baseline justify-between gap-2">
            <span>
              {row.name}
              <span className="text-muted-foreground"> · {row.to}</span>
            </span>
            <span className={row.status === "failed" ? "text-destructive" : "text-muted-foreground"}>
              {row.status === "sent" ? "נשלח" : row.status === "failed" ? "נכשל" : "לא נשלח"}
              {row.error ? ` — ${row.error}` : ""}
            </span>
          </li>
        ))}
      </ul>
    </div>
  );
}

function OnlineNow({ members, onlineIds }: { members: Member[]; onlineIds: string[] }) {
  const online = onlineIds
    .map((id) => memberById(members, id))
    .filter((member): member is Member => Boolean(member))
    .sort((a, b) => a.displayName.localeCompare(b.displayName, "he"));

  return (
    <Card className="paper-card rounded-[1.75rem]">
      <CardHeader>
        <CardTitle className="font-medium">מחוברים עכשיו</CardTitle>
      </CardHeader>
      <CardContent>
        <p className="text-sm font-light text-muted-foreground">
          {online.length === 1 ? "מחובר אחד כעת" : `${online.length} מחוברים כעת`}
        </p>
        {online.length === 0 ? (
          <p className="mt-3 text-sm font-light text-muted-foreground">אין אף אחד מחובר כרגע.</p>
        ) : (
          <ul className="mt-3 space-y-2">
            {online.map((member) => (
              <li key={member.id} className="flex items-center gap-3 rounded-xl bg-secondary px-3 py-2">
                <span className="relative">
                  <UserAvatar member={member} />
                  <span className="absolute -bottom-0.5 start-0 size-2.5 rounded-full bg-emerald-500 ring-2 ring-white" />
                </span>
                <div>
                  <div className="text-sm font-medium">{member.displayName}</div>
                  <div className="text-[12px] font-light text-muted-foreground">{roleLabel(member.role)}</div>
                </div>
              </li>
            ))}
          </ul>
        )}
      </CardContent>
    </Card>
  );
}
