"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

type Choice = { id: string; displayName: string; initials: string; avatarColor: string };

export function LoginView() {
  const router = useRouter();
  const [password, setPassword] = useState("");
  const [choices, setChoices] = useState<Choice[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function submit(memberId?: string) {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/auth", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ password, memberId }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error || "הכניסה נכשלה");
        return;
      }
      if (data.choices) {
        setChoices(data.choices as Choice[]);
        return;
      }
      if (data.mustChangePassword) {
        sessionStorage.setItem("chevra-password-alert", "1");
      }
      router.push(data.mustChangePassword ? "/?password=1" : "/");
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
        <p className="mx-auto mt-5 max-w-[26rem] text-center text-[15px] font-light leading-7 text-[#6f6a62]">
          האתר הרשמי של חבורת &ldquo;אש קודש&rdquo; או בשמה השני{" "}
          <span className="whitespace-nowrap">
            מיין חברה<span dir="ltr">.com</span>
          </span>
          . בהנאה!
        </p>

        <div className="mt-8 rounded-[1.5rem] bg-white p-6 ring-1 ring-[#e6e2da] md:p-8">
          <form
            className="space-y-4"
            onSubmit={(e) => {
              e.preventDefault();
              setChoices(null);
              void submit();
            }}
          >
            <div className="grid gap-1.5">
              <Label htmlFor="password" className="font-light text-[#6f6a62]">
                סיסמה
              </Label>
              <Input
                id="password"
                type="password"
                autoFocus
                autoComplete="current-password"
                value={password}
                onChange={(e) => {
                  setPassword(e.target.value);
                  setChoices(null);
                }}
                placeholder="הסיסמה שלכם"
                className="h-12 rounded-xl border-[#e6e2da] bg-[#faf9f7] px-4 text-base"
              />
            </div>
            {error ? <p className="text-sm text-destructive">{error}</p> : null}
            <Button
              type="submit"
              className="h-12 w-full rounded-xl bg-[#3f4650] text-base text-white hover:bg-[#333940]"
              disabled={loading || !password}
            >
              {loading ? "נכנס…" : "כניסה לחבורה"}
            </Button>
          </form>

          {choices ? (
            <div className="mt-6 border-t border-[#eeeae3] pt-5">
              <p className="mb-3 text-[13px] font-light leading-6 text-[#6f6a62]">
                הסיסמה הזו פתוחה לכמה חברים. בחרו את השם שלכם.
              </p>
              <div className="flex flex-col gap-2">
                {choices.map((choice) => (
                  <button
                    key={choice.id}
                    type="button"
                    disabled={loading}
                    onClick={() => void submit(choice.id)}
                    className="flex items-center gap-3 rounded-xl px-3 py-2 text-start ring-1 ring-[#e6e2da] hover:bg-[#f6f4f0]"
                  >
                    <span
                      className="flex size-8 items-center justify-center rounded-full text-xs text-white"
                      style={{ background: choice.avatarColor }}
                    >
                      {choice.initials}
                    </span>
                    <span className="text-sm">{choice.displayName}</span>
                  </button>
                ))}
              </div>
            </div>
          ) : null}
        </div>
      </div>
    </div>
  );
}
