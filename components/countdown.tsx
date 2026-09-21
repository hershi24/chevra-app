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
      <p className="text-sm font-normal text-primary">המפגש מתחיל עכשיו — מחכים לכם</p>
    );
  }

  const cells = [
    { label: "ימים", value: parts.days },
    { label: "שעות", value: parts.hours },
    { label: "דקות", value: parts.minutes },
    { label: "שניות", value: parts.seconds },
  ];

  return (
    <div className="flex divide-x divide-x-reverse divide-black/8">
      {cells.map((cell) => (
        <div key={cell.label} className="min-w-[4.5rem] px-4 first:ps-0 last:pe-0">
          <div className="text-[1.75rem] font-light tabular-nums tracking-tight text-foreground md:text-[2rem]">
            {String(cell.value).padStart(2, "0")}
          </div>
          <div className="mt-0.5 text-[11px] font-light text-muted-foreground">{cell.label}</div>
        </div>
      ))}
    </div>
  );
}
