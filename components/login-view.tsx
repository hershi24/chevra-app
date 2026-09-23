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
    <div className="flex min-h-dvh items-center justify-center bg-[#f6f4f0] px-4 py-12">
      <div className="w-full max-w-[26rem]">
        <p className="text-center text-[11px] font-light tracking-[0.28em] text-[#8a8478]">
          אש קודש
        </p>
        <h1 className="mt-3 text-center text-[2.35rem] font-medium tracking-tight text-[#2b2a27] md:text-[2.6rem]">
          מיין חברה
        </h1>
        <div className="mx-auto mt-4 h-px w-12 bg-[#c8c2b6]" />
        <p className="mx-auto mt-5 max-w-[24rem] text-center text-[15px] font-light leading-7 text-[#6f6a62]">
          האתר הרשמי של חבורת &ldquo;אש קודש&rdquo; או בשמה השני מיין חברה.com.
          <span className="mt-1 block">בהנאה!</span>
        </p>

        <div className="mt-8 rounded-[1.5rem] bg-white p-6 ring-1 ring-[#e6e2da] md:p-8">
          <form
            className="space-y-4"
            onSubmit={(e) => {
              e.preventDefault();
              void submit();
            }}
          >
            <div className="grid gap-1.5">
              <Label htmlFor="username" className="font-light text-[#6f6a62]">
                שם פרטי
              </Label>
              <Input
                id="username"
                autoFocus
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                placeholder="כפי שאתם מוכרים בחבורה"
                className="h-12 rounded-xl border-[#e6e2da] bg-[#faf9f7] px-4 text-base"
              />
            </div>
            {error ? <p className="text-sm text-destructive">{error}</p> : null}
            <Button
              type="submit"
              className="h-12 w-full rounded-xl bg-[#3f4650] text-base text-white hover:bg-[#333940]"
              disabled={loading}
            >
              {loading ? "נכנס…" : "כניסה לחבורה"}
            </Button>
          </form>

          <div className="mt-7 border-t border-[#eeeae3] pt-5">
            <p className="mb-3 text-[12px] font-light text-[#8a8478]">כניסה בשם חבר</p>
            <div className="flex flex-wrap gap-1.5">
              {QUICK.map((name) => (
                <button
                  key={name}
                  type="button"
                  onClick={() => {
                    setUsername(name);
                    void submit(name);
                  }}
                  className="rounded-full px-3 py-1.5 text-[13px] text-[#3f4650] ring-1 ring-[#e6e2da] transition hover:bg-[#f6f4f0]"
                >
                  {name}
                </button>
              ))}
            </div>
            <p className="mt-4 text-[11px] leading-5 text-[#9a958c]">
              דוד — מנהל המערכת · משה — מגיד השיעור · השאר חברי החבורה. בלי סיסמה.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
