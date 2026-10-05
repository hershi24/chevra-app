"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useApp } from "@/components/app-provider";
import { Button } from "@/components/ui/button";

export function PasswordNotice() {
  const { me } = useApp();
  const [open, setOpen] = useState(false);

  useEffect(() => {
    if (!me?.mustChangePassword) return;
    if (sessionStorage.getItem("chevra-password-alert") !== "1") return;
    setOpen(true);
    sessionStorage.removeItem("chevra-password-alert");
  }, [me?.mustChangePassword]);

  if (!me?.mustChangePassword) return null;

  const firstName = me.displayName.split(" ")[0];

  return (
    <>
      <div className="shrink-0 border-b border-[#d0d5dc] bg-[#e8ebf0] px-5 py-3 text-sm md:px-8">
        <div className="flex w-full flex-col items-start gap-1 md:flex-row md:items-center md:justify-between md:gap-6">
          <p>הסיסמה שלכם עדיין ברירת המחדל. מומלץ להחליף אותה.</p>
          <Link href="/settings#password" className="shrink-0 text-primary">
            להחלפת הסיסמה
          </Link>
        </div>
      </div>
      {open ? (
        <div className="fixed inset-0 z-[70] flex items-end justify-center bg-[#1f2328]/40 p-4 md:items-center md:p-8">
          <div
            role="dialog"
            aria-labelledby="password-alert-title"
            className="w-full max-w-md rounded-3xl border border-[#d5dbe3] bg-[#fbfcfd] p-6 shadow-[0_18px_50px_rgba(60,70,85,0.18)] md:max-w-[32rem] md:p-8"
          >
            <div className="mb-5 flex items-center justify-between gap-4">
              <h2 id="password-alert-title" className="text-xl leading-8 md:text-[1.7rem] md:leading-9">
                שלום ל{firstName}
              </h2>
              <img src="/brand-logo.png" alt="" aria-hidden="true" className="h-8 w-auto shrink-0 md:h-9" />
            </div>
            <p className="mt-3 text-sm leading-6 text-muted-foreground md:text-[15px] md:leading-7">
              הסיסמה עדיין 1234. זו הכניסה הראשונה עם סיסמת ברירת המחדל שנפתחה לחשבון. מומלץ להחליף אותה עכשיו לסיסמה שרק אתם מכירים.
            </p>
            <div className="mt-6 flex flex-col gap-2 md:flex-row md:items-center">
              <Button asChild className="h-11 rounded-full px-5">
                <Link href="/settings#password" onClick={() => setOpen(false)}>
                  להחלפת הסיסמה
                </Link>
              </Button>
              <Button variant="ghost" className="h-11 rounded-full px-5" onClick={() => setOpen(false)}>
                אחר כך
              </Button>
            </div>
          </div>
        </div>
      ) : null}
    </>
  );
}
