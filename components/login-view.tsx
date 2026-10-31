"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Eye, EyeOff } from "lucide-react";

type Choice = { id: string; displayName: string; initials: string; avatarColor: string };

function GoogleMark() {
  return (
    <svg width="18" height="18" viewBox="0 0 48 48" aria-hidden>
      <path fill="#FFC107" d="M43.6 20.5H42V20H24v8h11.3C33.7 32.7 29.3 36 24 36c-6.6 0-12-5.4-12-12s5.4-12 12-12c3.1 0 5.8 1.2 8 3.1l5.7-5.7C34.2 6.1 29.4 4 24 4 12.9 4 4 12.9 4 24s8.9 20 20 20 20-8.9 20-20c0-1.2-.1-2.3-.4-3.5z" />
      <path fill="#FF3D00" d="M6.3 14.7l6.6 4.8C14.7 16 19 12 24 12c3.1 0 5.8 1.2 8 3.1l5.7-5.7C34.2 6.1 29.4 4 24 4 16.3 4 9.6 8.3 6.3 14.7z" />
      <path fill="#4CAF50" d="M24 44c5.2 0 10-2 13.6-5.2l-6.3-5.3C29.3 35.1 26.8 36 24 36c-5.3 0-9.7-3.3-11.3-8l-6.5 5C9.5 39.6 16.2 44 24 44z" />
      <path fill="#1976D2" d="M43.6 20.5H42V20H24v8h11.3c-1.1 3.2-3.5 5.7-6.6 7.1l6.3 5.3C37.4 38.4 44 33 44 24c0-1.2-.1-2.3-.4-3.5z" />
    </svg>
  );
}

export function LoginView({ next, googleError }: { next?: string; googleError?: string }) {
  const router = useRouter();
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [choices, setChoices] = useState<Choice[] | null>(null);
  const [error, setError] = useState<string | null>(googleError ?? null);
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
      router.push(next ?? (data.mustChangePassword ? "/?password=1" : "/"));
      router.refresh();
    } finally {
      setLoading(false);
    }
  }

  return (
    <div
      className="min-h-dvh bg-[#1a120c] bg-cover bg-fixed"
      style={{ backgroundImage: "url(/login-bg.jpg)", backgroundPosition: "center 30%" }}
    >
      <div
        className="flex min-h-dvh flex-col items-center justify-center px-[18px] py-8 backdrop-blur-[3px]"
        style={{
          backgroundImage:
            "radial-gradient(ellipse at center, rgba(20,12,8,0.35), rgba(20,12,8,0.8)), linear-gradient(to top, rgba(20,12,8,0.85), rgba(20,12,8,0) 45%)",
        }}
      >
        <div
          className="w-full max-w-[420px] rounded-[28px] border border-white/30 bg-white/[0.12] px-[22px] pt-[30px] pb-6 text-center text-white backdrop-blur-[22px] backdrop-saturate-[1.4] md:px-[34px] md:pt-9 md:pb-[30px]"
          style={{ boxShadow: "0 30px 80px rgba(0,0,0,0.45), inset 0 1px 0 rgba(255,255,255,0.25)" }}
        >
          <img
            src="/brand-logo.png"
            alt="אש קודש · מיין חברה"
            width={900}
            height={471}
            className="mx-auto block h-auto w-[180px] md:w-[220px]"
            style={{ filter: "drop-shadow(0 6px 18px rgba(0,0,0,0.45))" }}
          />
          <div className="mx-auto mt-[18px] h-0.5 w-11 bg-gradient-to-r from-transparent via-[#d9b36a] to-transparent" />
          <h1 className="mt-4 text-[26px] font-normal">ברוכים הבאים לחבורה</h1>
          <p className="mt-1.5 text-sm leading-7 text-white/70">
            האתר הרשמי של &ldquo;אש קודש&rdquo; · מיין חברה
          </p>

          <form
            className="mt-[26px] text-right"
            onSubmit={(e) => {
              e.preventDefault();
              setChoices(null);
              void submit();
            }}
          >
            <label htmlFor="password" className="sr-only">
              סיסמה
            </label>
            <div className="relative">
              <input
                id="password"
                type={showPassword ? "text" : "password"}
                autoFocus
                autoComplete="current-password"
                value={password}
                onChange={(e) => {
                  setPassword(e.target.value);
                  setChoices(null);
                }}
                placeholder="הסיסמה שלכם"
                className="h-[54px] w-full rounded-2xl border border-white/35 bg-white/[0.92] ps-[18px] pe-12 text-base text-[#1f2328] outline-none placeholder:text-[#9aa1ab] focus:border-[#d9b36a] focus:ring-4 focus:ring-[#d9b36a]/25"
              />
              <button
                type="button"
                onClick={() => setShowPassword((value) => !value)}
                aria-label={showPassword ? "הסתרת הסיסמה" : "הצגת הסיסמה"}
                className="absolute end-3 top-1/2 flex size-8 -translate-y-1/2 items-center justify-center rounded-full text-[#9aa1ab] hover:text-[#6b7280]"
              >
                {showPassword ? <EyeOff className="size-5" /> : <Eye className="size-5" />}
              </button>
            </div>
            {error ? <p className="mt-2.5 text-center text-sm text-[#ffb4a8]">{error}</p> : null}
            <button
              type="submit"
              disabled={loading || !password}
              className="mt-3.5 h-[54px] w-full rounded-2xl text-[17px] text-white transition-opacity disabled:opacity-60"
              style={{
                background: "linear-gradient(180deg, #c9a15a, #a9782c)",
                boxShadow: "0 12px 28px -10px rgba(201,161,90,0.9), inset 0 1px 0 rgba(255,255,255,0.35)",
              }}
            >
              {loading ? "נכנס…" : "כניסה"}
            </button>
            <div className="mt-4 flex items-center gap-3 text-[12px] text-white/55">
              <span className="h-px flex-1 bg-white/20" />
              או
              <span className="h-px flex-1 bg-white/20" />
            </div>
            <a
              href={next ? `/api/auth/google?next=${encodeURIComponent(next)}` : "/api/auth/google"}
              className="mt-4 flex h-[54px] items-center justify-center gap-3 rounded-2xl bg-white text-[16px] text-[#1f2328]"
            >
              <GoogleMark />
              התחברות עם גוגל
            </a>
          </form>

          {choices ? (
            <div className="mt-6 border-t border-white/20 pt-5 text-right">
              <p className="mb-3 text-[13px] leading-6 text-white/75">
                הסיסמה הזו פתוחה לכמה חברים. בחרו את השם שלכם.
              </p>
              <div className="flex flex-col gap-2">
                {choices.map((choice) => (
                  <button
                    key={choice.id}
                    type="button"
                    disabled={loading}
                    onClick={() => void submit(choice.id)}
                    className="flex items-center gap-3 rounded-2xl border border-white/25 bg-white/10 px-3 py-2 text-start hover:bg-white/20"
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

          <p className="mt-4 text-[12.5px] text-white/60">שכחתם סיסמה? פנו למנהל החבורה</p>
        </div>
        <p className="mt-6 text-xs text-white/50">בהנאה!</p>
      </div>
    </div>
  );
}
