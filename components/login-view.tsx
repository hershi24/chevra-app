"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

const QUICK = ["דוד", "משה", "יוסף", "אברהם", "יעקב", "שלמה", "נתן", "חיים"];

export function LoginView() {
  const router = useRouter();
  const [username, setUsername] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function submit(name = username) {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/auth", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ username: name }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error || "הכניסה נכשלה");
        return;
      }
      router.push("/");
      router.refresh();
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="relative flex min-h-dvh items-center justify-center overflow-hidden px-4">
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src="https://images.unsplash.com/photo-1414235077428-338989a2e8c0?auto=format&fit=crop&w=1800&q=80"
        alt=""
        className="absolute inset-0 h-full w-full object-cover"
      />
      <div className="absolute inset-0 bg-[#2b2118]/45" />
      <div className="relative w-full max-w-md rounded-3xl bg-[#fffaf4]/92 p-6 shadow-2xl backdrop-blur-md md:p-8">
        <p className="text-[13px] font-light tracking-[0.22em] text-primary/80">CHEVRA</p>
        <h1 className="mt-2 text-4xl font-medium tracking-tight text-foreground">מיין חברה</h1>
        <p className="mt-3 text-[15px] font-light leading-7 text-muted-foreground">
          חבורה קרובה של חברים נשואים — לימוד, כינוס, וצ׳אט במקום אחד.
        </p>
        <form
          className="mt-6 space-y-3"
          onSubmit={(e) => {
            e.preventDefault();
            void submit();
          }}
        >
          <div className="grid gap-1.5">
            <Label htmlFor="username">שם משתמש</Label>
            <Input
              id="username"
              autoFocus
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              placeholder="השם הפרטי בחבורה"
              className="h-11 text-base"
            />
          </div>
          {error ? <p className="text-sm text-destructive">{error}</p> : null}
          <Button type="submit" className="h-11 w-full" disabled={loading}>
            {loading ? "נכנס…" : "כניסה לחבורה"}
          </Button>
        </form>
        <div className="mt-5">
          <p className="mb-2 text-xs text-muted-foreground">כניסה מהירה להדגמה</p>
          <div className="flex flex-wrap gap-1.5">
            {QUICK.map((name) => (
              <button
                key={name}
                type="button"
                onClick={() => {
                  setUsername(name);
                  void submit(name);
                }}
                className="rounded-full bg-primary/10 px-3 py-1 text-sm text-primary hover:bg-primary/15"
              >
                {name}
              </button>
            ))}
          </div>
          <p className="mt-3 text-[11px] leading-5 text-muted-foreground">
            דוד = מנהל מערכת · משה = מגיד שיעור · השאר חברי חבורה. בלי סיסמה.
          </p>
        </div>
      </div>
    </div>
  );
}
