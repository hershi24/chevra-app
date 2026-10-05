"use client";

import { useEffect } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import {
  BookOpen,
  Images,
  LayoutDashboard,
  LogOut,
  MessageCircle,
  Receipt,
  Settings,
} from "lucide-react";
import { AppProvider, useApp } from "@/components/app-provider";
import type { PublicState } from "@/lib/types";
import { PasswordNotice } from "@/components/password-notice";
import { BackgroundLayer } from "@/components/background-layer";
import { UserAvatar } from "@/components/user-avatar";
import { Button } from "@/components/ui/button";
import { roleLabel } from "@/lib/format";
import { cn } from "@/lib/utils";

const NAV = [
  { href: "/", label: "לוח ראשי", short: "לוח", icon: LayoutDashboard },
  { href: "/journal", label: "יומן החבורה", short: "יומן", icon: BookOpen },
  { href: "/gallery", label: "גלריה", short: "גלריה", icon: Images },
  { href: "/chat", label: "צ׳אט", short: "צ׳אט", icon: MessageCircle },
  { href: "/expenses", label: "באו חשבון", short: "באו חשבון", icon: Receipt },
  { href: "/settings", label: "הגדרות", short: "הגדרות", icon: Settings },
];

export function AppShell({
  children,
  initial,
}: {
  children: React.ReactNode;
  initial: PublicState;
}) {
  return (
    <AppProvider initial={initial}>
      <ShellFrame>{children}</ShellFrame>
    </AppProvider>
  );
}

function ShellFrame({ children }: { children: React.ReactNode }) {
  const { me, state, loading, error, logout } = useApp();
  const pathname = usePathname();
  const router = useRouter();

  useEffect(() => {
    const onClick = (event: MouseEvent) => {
      if (event.defaultPrevented || event.button !== 0) return;
      if (event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
      const anchor = (event.target as Element | null)?.closest("a");
      if (!(anchor instanceof HTMLAnchorElement)) return;
      if (anchor.target && anchor.target !== "_self") return;
      if (anchor.hasAttribute("download")) return;
      const url = new URL(anchor.href, window.location.href);
      if (url.origin !== window.location.origin) return;
      if (url.pathname === window.location.pathname && url.search === window.location.search) return;
      if (typeof document.startViewTransition !== "function") return;
      event.preventDefault();
      const before = document.querySelector("main")?.innerText ?? "";
      document.startViewTransition(async () => {
        router.push(`${url.pathname}${url.search}${url.hash}`);
        const begun = performance.now();
        await new Promise<void>((resolve) => {
          const check = () => {
            const now = document.querySelector("main")?.innerText ?? "";
            if ((now && now !== before) || performance.now() - begun > 1200) {
              setTimeout(resolve, 0);
              return;
            }
            setTimeout(check, 16);
          };
          check();
        });
      });
    };
    document.addEventListener("click", onClick, true);
    return () => document.removeEventListener("click", onClick, true);
  }, [router]);

  const isChat = pathname.startsWith("/chat");
  const isDashboard = pathname === "/";
  const nav =
    state?.settings.showExpenses === false ? NAV.filter((item) => item.href !== "/expenses") : NAV;

  if (loading) {
    return (
      <div className="flex min-h-dvh items-center justify-center bg-background text-muted-foreground">
        טוען את החבורה…
      </div>
    );
  }

  if (error || !me) {
    return (
      <div className="flex min-h-dvh flex-col items-center justify-center gap-3 bg-background">
        <p>{error ?? "יש להתחבר מחדש"}</p>
        <Button onClick={() => router.replace("/login")}>למסך הכניסה</Button>
      </div>
    );
  }

  return (
    <div className={cn("min-h-dvh", isChat && "flex h-dvh flex-col overflow-hidden")}>
      <BackgroundLayer />

      <header className="sticky top-0 z-30 hidden h-[72px] shrink-0 border-b border-[#e3e6eb] bg-[#fbfcfd] md:block">
        <div className="flex h-full items-center justify-between gap-6 px-5 md:px-8">
          <Link href="/" className="flex min-w-0 shrink-0 items-center gap-3">
            <img src="/brand-logo.png" alt="" className="h-[38px] w-auto" />
            <span className="min-w-0 text-start">
              <span className="block text-[20px] leading-none tracking-tight">אש קודש</span>
              <span className="mt-1 block text-[11px] font-light text-[#8a8174]">מיין חברה</span>
            </span>
          </Link>

          <nav className="flex h-full min-w-0 items-stretch">
            {nav.map((item) => {
              const active =
                item.href === "/" ? pathname === "/" : pathname.startsWith(item.href);
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  title={item.label}
                  aria-current={active ? "page" : undefined}
                  className={cn(
                    "relative flex items-center gap-2 px-2.5 text-[14px] font-light lg:px-4 lg:text-[15px]",
                    active ? "text-foreground" : "text-muted-foreground hover:text-foreground"
                  )}
                >
                  <item.icon className={cn("size-4 shrink-0", active && "text-primary")} />
                  {item.short}
                  {active ? (
                    <span className="absolute inset-x-2.5 bottom-0 h-0.5 rounded-t bg-primary lg:inset-x-4" />
                  ) : null}
                </Link>
              );
            })}
          </nav>

          <div className="flex shrink-0 items-center gap-3 rounded-full bg-[#f4f6f8] py-1.5 ps-3.5 pe-1.5">
            <div className="hidden min-w-0 text-start lg:block">
              <div className="truncate text-[13px]">{me.displayName}</div>
              <div className="text-[11px] font-light text-muted-foreground">{roleLabel(me.role)}</div>
            </div>
            <UserAvatar member={me} />
            <Button
              variant="ghost"
              size="icon-sm"
              className="text-[#8b919a]"
              onClick={() => void logout()}
              aria-label="יציאה"
            >
              <LogOut className="size-4" />
            </Button>
          </div>
        </div>
      </header>

      <header
        className={cn(
          "sticky top-0 z-20 shrink-0 items-center justify-between border-b border-[#d0d5dc] bg-[#e4e8ee] px-4 py-3 md:hidden",
          isDashboard ? "flex" : "hidden"
        )}
      >
        <div>
          <img src="/brand-logo.png" alt="אש קודש" className="h-[34px] w-auto" />
          <div className="text-[11px] text-muted-foreground">{me.displayName}</div>
        </div>
        <UserAvatar member={me} size="sm" />
      </header>

      <PasswordNotice />

      <main
        className={cn(
          isChat
            ? cn(
                "page-stage flex min-h-0 flex-1 flex-col overflow-hidden md:pb-0",
                nav.some((item) => item.href === "/expenses")
                  ? "pb-[calc(5.25rem+env(safe-area-inset-bottom))]"
                  : "pb-[calc(4rem+env(safe-area-inset-bottom))]"
              )
            : "page-stage px-5 py-6 pb-28 md:px-8 md:py-10 md:pb-16"
        )}
      >
        {children}
      </main>

      <nav
        className={cn(
          "fixed inset-x-0 bottom-0 z-30 grid border-t border-[#d0d5dc] bg-[#e4e8ee] pb-[env(safe-area-inset-bottom)] md:hidden",
          nav.length > 5 ? "grid-cols-6" : "grid-cols-5"
        )}
      >
        {nav.map((item) => {
          const active =
            item.href === "/" ? pathname === "/" : pathname.startsWith(item.href);
          return (
            <Link
              key={item.href}
              href={item.href}
              className={cn(
                "flex flex-col items-center gap-1 py-2.5 text-[10px] font-light",
                active ? "text-primary" : "text-muted-foreground"
              )}
            >
              <item.icon className="size-5" />
              {item.href === "/expenses" ? (
                <span className="text-center leading-[1.15]">
                  באו
                  <br />
                  חשבון
                </span>
              ) : (
                item.short
              )}
            </Link>
          );
        })}
      </nav>
    </div>
  );
}
