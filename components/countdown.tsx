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
    ...(parts.days ? [{ label: "ימים", value: parts.days }] : []),
    { label: "שעות", value: parts.hours },
    { label: "דקות", value: parts.minutes },
    { label: "שניות", value: parts.seconds },
  ];

  return (
    <div className="flex items-stretch" role="timer" aria-label="ספירה לאחור לחברה">
      {cells.map((cell, index) => (
        <div key={cell.label} className="flex items-stretch">
          {index > 0 ? (
            <span aria-hidden className="my-1 w-px shrink-0 self-stretch bg-[#dde1e7]" />
          ) : null}
          <div className="flex w-[3.6rem] flex-col items-center md:w-[4rem]">
            <span className="font-normal tabular-nums text-[1.4rem] leading-none tracking-tight text-foreground md:text-[1.55rem]">
              {String(cell.value).padStart(2, "0")}
            </span>
            <span className="mt-1.5 text-[11px] font-light leading-none text-muted-foreground">
              {cell.label}
            </span>
          </div>
        </div>
      ))}
    </div>
  );
}
