"use client";

import { useEffect, useState } from "react";
import { countdownParts } from "@/lib/format";
import { cn } from "@/lib/utils";

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
    <div className="flex items-stretch" role="timer" aria-label="ספירה לאחור לחברה">
      {cells.map((cell, index) => (
        <div
          key={cell.label}
          className={cn(
            "flex w-[4.15rem] flex-col items-center justify-center px-3 md:w-[4.6rem] md:px-4",
            index > 0 && "border-s border-[#e5e7eb]"
          )}
        >
          <span className="font-medium tabular-nums text-[1.6rem] leading-none tracking-tight text-foreground md:text-[1.8rem]">
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
