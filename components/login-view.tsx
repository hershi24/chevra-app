"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { BookOpen, Coffee, Heart } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

const QUICK = [
  { name: "דוד", initials: "דכ", color: "#0F766E" },
  { name: "משה", initials: "מל", color: "#B45309" },
  { name: "יוסף", initials: "יג", color: "#1D4ED8" },
  { name: "אברהם", initials: "אש", color: "#7C3AED" },
  { name: "יעקב", initials: "יר", color: "#BE123C" },
  { name: "שלמה", initials: "שפ", color: "#047857" },
  { name: "נתן", initials: "נב", color: "#C2410C" },
  { name: "חיים", initials: "חו", color: "#0E7490" },
];

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
    <div className="relative flex min-h-dvh items-center justify-center overflow-hidden px-4 py-10">
      <div className="pointer-events-none absolute inset-0 bg-[#fff8f1]" />
      <div className="pointer-events-none absolute -top-24 start-[-4rem] size-[22rem] rounded-full bg-[#fde68a]/70 blur-3xl" />
      <div className="pointer-events-none absolute top-20 end-[-5rem] size-[18rem] rounded-full bg-[#fdba74]/50 blur-3xl" />
      <div className="pointer-events-none absolute bottom-[-6rem] start-1/4 size-[20rem] rounded-full bg-[#fecdd3]/45 blur-3xl" />
      <LoginDoodles />

      <div className="relative w-full max-w-[28rem] rounded-[2rem] bg-white/90 p-6 shadow-[0_20px_50px_-24px_rgba(180,83,9,0.35)] ring-1 ring-[#f3d2a8] backdrop-blur-sm md:p-8">
        <div className="flex justify-center">
          <div className="flex -space-x-2 space-x-reverse">
            {QUICK.slice(0, 5).map((member) => (
              <span
                key={member.name}
                className="flex size-10 items-center justify-center rounded-full text-[12px] font-medium text-white ring-2 ring-white"
                style={{ background: member.color }}
              >
                {member.initials}
              </span>
            ))}
          </div>
        </div>

        <p className="mt-5 text-center text-[13px] font-light text-[#b45309]">ברוכים הבאים</p>
        <h1 className="mt-1 text-center text-[2.15rem] font-medium tracking-tight text-[#3f2a14] md:text-[2.4rem]">
          מיין חברה
        </h1>
        <p className="mx-auto mt-3 max-w-[22rem] text-center text-[15px] font-light leading-7 text-[#7c5a38]">
          נכנסים, יושבים סביב השולחן, לומדים וצוחקים. החבורה כבר מחכה לכם בפנים.
        </p>

        <div className="mt-5 flex flex-wrap items-center justify-center gap-2">
          <MoodChip icon={BookOpen} label="לימוד" />
          <MoodChip icon={Coffee} label="כיבוד ושיחה" />
          <MoodChip icon={Heart} label="חברים" />
        </div>

        <form
          className="mt-6 space-y-3"
          onSubmit={(e) => {
            e.preventDefault();
            void submit();
          }}
        >
          <div className="grid gap-1.5">
            <Label htmlFor="username" className="text-[#6b4b2e]">
              שם משתמש
            </Label>
            <Input
              id="username"
              autoFocus
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              placeholder="השם הפרטי בחבורה"
              className="h-12 rounded-full border-[#f0d3a8] bg-[#fffdf8] px-4 text-base"
            />
          </div>
          {error ? <p className="text-sm text-destructive">{error}</p> : null}
          <Button
            type="submit"
            className="h-12 w-full rounded-full bg-[#0f766e] text-base text-white hover:bg-[#0d6a63]"
            disabled={loading}
          >
            {loading ? "נכנסים לחבורה…" : "בואו נכנס"}
          </Button>
        </form>

        <div className="mt-6">
          <p className="mb-3 text-center text-xs text-[#9a7349]">או היכנסו בשם שלכם</p>
          <div className="grid grid-cols-4 gap-2">
            {QUICK.map((member) => (
              <button
                key={member.name}
                type="button"
                onClick={() => {
                  setUsername(member.name);
                  void submit(member.name);
                }}
                className="flex flex-col items-center gap-1.5 rounded-2xl bg-[#fff7ed] px-1 py-2.5 text-[#5b3d1f] ring-1 ring-[#f3d2a8] transition hover:-translate-y-0.5 hover:bg-[#ffedd5]"
              >
                <span
                  className="flex size-8 items-center justify-center rounded-full text-[11px] font-medium text-white"
                  style={{ background: member.color }}
                >
                  {member.initials}
                </span>
                <span className="text-[12px] font-medium">{member.name}</span>
              </button>
            ))}
          </div>
          <p className="mt-4 text-center text-[11px] leading-5 text-[#9a7349]">
            דוד מנהל · משה מגיד שיעור · השאר חברים. בלי סיסמה — רק לבוא.
          </p>
        </div>
      </div>
    </div>
  );
}

function MoodChip({
  icon: Icon,
  label,
}: {
  icon: typeof BookOpen;
  label: string;
}) {
  return (
    <span className="inline-flex items-center gap-1.5 rounded-full bg-[#fff7ed] px-3 py-1 text-[12px] text-[#9a5b12] ring-1 ring-[#f3d2a8]">
      <Icon className="size-3.5" />
      {label}
    </span>
  );
}

function LoginDoodles() {
  return (
    <svg
      className="pointer-events-none absolute inset-0 h-full w-full text-[#d97706]/25"
      viewBox="0 0 800 900"
      fill="none"
      aria-hidden
    >
      <circle cx="92" cy="160" r="10" fill="#f59e0b" opacity="0.35" />
      <circle cx="720" cy="220" r="8" fill="#fb7185" opacity="0.4" />
      <circle cx="680" cy="720" r="12" fill="#14b8a6" opacity="0.28" />
      <path d="M70 780c40-30 90-20 120 10" stroke="#f59e0b" strokeWidth="3" strokeLinecap="round" opacity="0.35" />
      <path d="M640 120c30 20 40 50 18 78" stroke="#fb7185" strokeWidth="3" strokeLinecap="round" opacity="0.3" />
    </svg>
  );
}
