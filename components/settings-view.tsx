"use client";

import { useRef, useState } from "react";
import { toast } from "sonner";
import { useApp } from "@/components/app-provider";
import { UserAvatar } from "@/components/user-avatar";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { roleLabel } from "@/lib/format";
import { can } from "@/lib/permissions";
import { upcomingGathering } from "@/lib/selectors";
import type { Role } from "@/lib/types";
import { cn } from "@/lib/utils";

export function SettingsView() {
  const { state, me, act, logout } = useApp();
  const fileRef = useRef<HTMLInputElement>(null);
  const [invitePreview, setInvitePreview] = useState<
    { to: string; yesUrl: string; noUrl: string }[] | null
  >(null);

  if (!state || !me) return null;
  const user = me;
  const event = upcomingGathering(state);

  async function sendInvites() {
    if (!event) return;
    const res = await fetch("/api/invitations", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ eventId: event.id }),
    });
    const data = await res.json();
    if (!res.ok) {
      toast.error(data.error || "שליחה נכשלה");
      return;
    }
    setInvitePreview(data.sent);
    toast.success(data.mock ? "ההזמנות מוכנות (מצב הדגמה, בלי Resend)" : "ההזמנות נשלחו");
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
        <p className="text-[13px] font-light text-muted-foreground">ניהול חברים, רקעים והזמנות</p>
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
            </div>
            <input
              ref={fileRef}
              type="file"
              accept="image/*"
              className="hidden"
              onChange={async (e) => {
                const file = e.target.files?.[0];
                if (!file) return;
                const body = new FormData();
                body.append("file", file);
                const res = await fetch("/api/upload", { method: "POST", body });
                const data = await res.json();
                if (!res.ok) return toast.error("העלאה נכשלה");
                await act({
                  type: "addBackground",
                  url: data.url,
                  label: file.name.replace(/\.[^.]+$/, ""),
                });
                toast.success("הרקע נוסף");
              }}
            />
            <Button variant="outline" onClick={() => fileRef.current?.click()}>
              העלאת תמונה מחברה קודמת
            </Button>
          </CardContent>
        </Card>
      ) : null}

      {can(me, "manageMembers") ? (
        <Card className="paper-card rounded-[1.75rem]">
          <CardHeader>
            <CardTitle className="font-medium">חברי החבורה</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <ul className="space-y-2">
              {state.members.map((member) => (
                <li
                  key={member.id}
                  className="flex flex-wrap items-center justify-between gap-2 rounded-xl bg-[#f7f1e8] px-3 py-2"
                >
                  <span className="flex items-center gap-2">
                    <UserAvatar member={member} size="sm" />
                    <span>
                      <span className="block text-sm font-medium">{member.displayName}</span>
                      <span className="text-[11px] text-muted-foreground">
                        {member.username} · {member.phone}
                      </span>
                    </span>
                  </span>
                  <select
                    className="h-8 rounded-lg border border-input bg-white px-2 text-xs"
                    value={member.role}
                    onChange={(e) =>
                      void act({
                        type: "setRole",
                        memberId: member.id,
                        role: e.target.value as Role,
                      }).catch((err) => toast.error(err.message))
                    }
                  >
                    <option value="admin">מנהל מערכת</option>
                    <option value="leader">מגיד שיעור</option>
                    <option value="member">חבר</option>
                  </select>
                </li>
              ))}
            </ul>
            <form
              className="grid gap-2 rounded-xl border border-dashed p-3 md:grid-cols-2"
              onSubmit={async (e) => {
                e.preventDefault();
                const form = e.currentTarget;
                const data = new FormData(form);
                try {
                  await act({
                    type: "addMember",
                    username: String(data.get("username")),
                    displayName: String(data.get("displayName")),
                    phone: String(data.get("phone")),
                    email: String(data.get("email")),
                  });
                  form.reset();
                  toast.success("חבר נוסף לחבורה");
                } catch (error) {
                  toast.error(error instanceof Error ? error.message : "שגיאה");
                }
              }}
            >
              <div className="grid gap-1.5">
                <Label htmlFor="username">שם משתמש</Label>
                <Input id="username" name="username" required />
              </div>
              <div className="grid gap-1.5">
                <Label htmlFor="displayName">שם מלא</Label>
                <Input id="displayName" name="displayName" required />
              </div>
              <div className="grid gap-1.5">
                <Label htmlFor="phone">טלפון</Label>
                <Input id="phone" name="phone" placeholder="050..." />
              </div>
              <div className="grid gap-1.5">
                <Label htmlFor="email">אימייל</Label>
                <Input id="email" name="email" type="email" />
              </div>
              <Button className="md:col-span-2">הוספת חבר</Button>
            </form>
          </CardContent>
        </Card>
      ) : (
        <Card className="paper-card rounded-[1.75rem]">
          <CardHeader>
            <CardTitle className="font-medium">חברי החבורה</CardTitle>
          </CardHeader>
          <CardContent className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {state.members.map((member) => (
              <div key={member.id} className="flex items-center gap-2">
                <UserAvatar member={member} />
                <div>
                  <div className="text-sm font-medium">{member.displayName}</div>
                  <div className="text-xs text-muted-foreground">{roleLabel(member.role)}</div>
                </div>
              </div>
            ))}
          </CardContent>
        </Card>
      )}

      {can(me, "sendInvites") ? (
        <Card className="paper-card rounded-[1.75rem]">
          <CardHeader>
            <CardTitle className="font-medium">הזמנות במייל · לחיצה אחת</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <p className="text-sm text-muted-foreground">
              שליחת HTML עם כפתורי [מאשר הגעה] / [לא אוכל להגיע]. כל קישור מעדכן את היומן בלי התחברות.
              בלי מפתח Resend ההזמנות נשמרות כאן עם קישורים לבדיקה.
            </p>
            <div className="flex flex-wrap gap-2">
              <Button onClick={() => void sendInvites()} disabled={!event}>
                שליחת הזמנות למפגש הקרוב
              </Button>
              {can(me, "triggerIvr") ? (
                <Button variant="outline" onClick={() => void pingIvr()}>
                  צילצול / IVR
                </Button>
              ) : null}
            </div>
            {invitePreview?.length ? (
              <ul className="space-y-2 text-sm">
                {invitePreview.map((row) => (
                  <li key={row.to} className="rounded-xl bg-[#f7f1e8] p-3">
                    <div className="font-medium">{row.to}</div>
                    <div className="mt-1 flex flex-wrap gap-2">
                      <a className="text-primary underline" href={row.yesUrl}>
                        מאשר הגעה
                      </a>
                      <a className="text-destructive underline" href={row.noUrl}>
                        לא אוכל להגיע
                      </a>
                    </div>
                  </li>
                ))}
              </ul>
            ) : null}
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
