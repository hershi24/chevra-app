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

  return (
    <>
      <div className="border-b border-black/10 bg-[#f6f4f0] px-4 py-3 text-sm">
        <p>
          הסיסמה שלכם עדיין ברירת המחדל. מומלץ להחליף אותה.
        </p>
        <Link href="/settings#password" className="mt-1 inline-block font-medium underline">
          להחלפת הסיסמה
        </Link>
      </div>
      {open ? (
        <div className="fixed inset-0 z-[70] flex items-end justify-center bg-black/40 p-4 md:items-center">
          <div role="dialog" aria-labelledby="password-alert-title" className="w-full max-w-md rounded-3xl bg-white p-5 shadow-2xl">
            <h2 id="password-alert-title" className="text-lg font-medium">
              הסיסמה עדיין 1234
            </h2>
            <p className="mt-2 text-sm leading-6 text-muted-foreground">
              זו הכניסה הראשונה עם סיסמת ברירת המחדל שנפתחה לחשבון. מומלץ להחליף אותה עכשיו לסיסמה שרק אתם מכירים.
            </p>
            <div className="mt-4 flex flex-col gap-2">
              <Button asChild className="h-11 rounded-xl">
                <Link href="/settings#password" onClick={() => setOpen(false)}>
                  להחלפת הסיסמה
                </Link>
              </Button>
              <Button variant="outline" className="h-11 rounded-xl" onClick={() => setOpen(false)}>
                אחר כך
              </Button>
            </div>
          </div>
        </div>
      ) : null}
    </>
  );
}
