"use client";

import { useEffect } from "react";
import { ArrowRight, Printer } from "lucide-react";
import { Button } from "@/components/ui/button";

export function PrintToolbar() {
  useEffect(() => {
    const timer = window.setTimeout(() => {
      void document.fonts.ready.then(() => window.print());
    }, 400);
    return () => window.clearTimeout(timer);
  }, []);

  return (
    <div className="mx-auto mb-4 flex w-full max-w-[210mm] items-center justify-between gap-3 px-2 print:hidden">
      <Button
        variant="ghost"
        className="rounded-full"
        onClick={() => (window.history.length > 1 ? window.history.back() : window.close())}
      >
        <ArrowRight data-icon="inline-start" />
        חזרה
      </Button>
      <Button className="rounded-full" onClick={() => window.print()}>
        <Printer data-icon="inline-start" />
        הדפסה / שמירה כ־PDF
      </Button>
    </div>
  );
}
