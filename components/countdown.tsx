"use client";

import { useEffect, useState } from "react";
import { countdownParts } from "@/lib/format";

export function Countdown({ iso }: { iso: string }) {
  const [parts, setParts] = useState(() => countdownParts(iso));

  useEffect(() => {
    const id = setInterval(() => setParts(countdownParts(iso)), 1000);
    return () => clearInterval(id);
  }, [iso]);

  if (parts.expired) {
    return (
      <p className="text-sm font-normal text-primary">החברה מתחילה עכשיו — מחכים לכם</p>
    );
  }

  const cells = [
    { label: "ימים", value: parts.days },
    { label: "שעות", value: parts.hours },
    { label: "דקות", value: parts.minutes },
    { label: "שניות", value: parts.seconds },
  ];

  return (
    <div className="flex gap-1.5 sm:gap-2" role="timer" aria-label="ספירה לאחור לחברה">
      {cells.map((cell) => (
        <div
          key={cell.label}
          className="flex flex-1 flex-col items-center rounded-2xl border border-[#e6e9ee] bg-white px-2 pb-2 pt-2.5 sm:w-[4.4rem] sm:flex-none"
        >
          <span className="font-normal tabular-nums text-[1.45rem] leading-none tracking-tight text-foreground md:text-[1.6rem]">
            {String(cell.value).padStart(2, "0")}
          </span>
          <span className="mt-1.5 text-[11px] font-normal leading-none text-muted-foreground">
            {cell.label}
          </span>
        </div>
      ))}
    </div>
  );
}
