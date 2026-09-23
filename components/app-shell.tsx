"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import {
  BookOpen,
  Images,
  LayoutDashboard,
  LogOut,
  MessageCircle,
  Settings,
} from "lucide-react";
import { AppProvider, useApp } from "@/components/app-provider";
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
  { href: "/settings", label: "הגדרות", short: "הגדרות", icon: Settings },
];

export function AppShell({ children }: { children: React.ReactNode }) {
  return (
    <AppProvider>
      <ShellFrame>{children}</ShellFrame>
    </AppProvider>
  );
}

function ShellFrame({ children }: { children: React.ReactNode }) {
  const { me, loading, error, logout } = useApp();
  const pathname = usePathname();
  const router = useRouter();
  const isChat = pathname.startsWith("/chat");
  const isChatThread = pathname.startsWith("/chat/");

  if (loading) {
    return (
      <div className="flex min-h-dvh items-center justify-center bg-white text-muted-foreground">
        טוען את החבורה…
      </div>
    );
  }

  if (error || !me) {
    return (
      <div className="flex min-h-dvh flex-col items-center justify-center gap-3 bg-white">
        <p>{error ?? "יש להתחבר מחדש"}</p>
        <Button onClick={() => router.replace("/login")}>למסך הכניסה</Button>
      </div>
    );
  }

  return (
    <div className="min-h-dvh">
      <BackgroundLayer />

      <header className="sticky top-0 z-30 hidden h-16 border-b border-black/5 bg-white md:block">
        <div className="mx-auto flex h-full max-w-6xl items-center justify-between gap-6 px-8">
          <Link href="/" className="min-w-0 shrink-0">
            <div className="text-[11px] font-light tracking-[0.22em] text-muted-foreground">
              CHEVRA
            </div>
            <div className="text-[1.15rem] font-medium leading-none tracking-tight text-foreground">
              מיין חברה
            </div>
          </Link>

          <nav className="flex items-center rounded-full bg-[var(--paper-card)] p-1">
            {NAV.map((item) => {
              const active =
                item.href === "/" ? pathname === "/" : pathname.startsWith(item.href);
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  title={item.label}
                  aria-current={active ? "page" : undefined}
                  className={cn(
                    "flex items-center gap-2 rounded-full px-2.5 py-1.5 text-[13px] font-light transition lg:px-3.5",
                    active
                      ? "bg-white text-foreground shadow-sm"
                      : "text-muted-foreground hover:text-foreground"
                  )}
                >
                  <item.icon className="size-3.5" />
                  {item.short}
                </Link>
              );
            })}
          </nav>

          <div className="flex min-w-0 items-center gap-3">
            <div className="hidden min-w-0 text-end lg:block">
              <div className="truncate text-[13px] font-normal">{me.displayName}</div>
              <div className="text-[11px] font-light text-muted-foreground">
                {roleLabel(me.role)}
              </div>
            </div>
            <UserAvatar member={me} />
            <Button variant="ghost" size="icon-sm" onClick={() => void logout()} aria-label="יציאה">
              <LogOut className="size-4" />
            </Button>
          </div>
        </div>
      </header>

      <header
        className={cn(
          "sticky top-0 z-20 items-center justify-between border-b border-black/5 bg-white px-4 py-3 md:hidden",
          isChatThread ? "hidden" : "flex"
        )}
      >
        <div>
          <div className="text-[1.05rem] font-medium tracking-tight">מיין חברה</div>
          <div className="text-[11px] text-muted-foreground">{me.displayName}</div>
        </div>
        <UserAvatar member={me} size="sm" />
      </header>

      <main
        className={cn(
          isChat
            ? "pb-0 md:h-[calc(100dvh-4rem)] md:overflow-hidden"
            : "px-5 py-6 pb-24 md:px-8 md:py-10 md:pb-16"
        )}
      >
        {children}
      </main>

      <nav className="fixed inset-x-0 bottom-0 z-30 grid grid-cols-5 border-t border-black/5 bg-white pb-[env(safe-area-inset-bottom)] md:hidden">
        {NAV.map((item) => {
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
              {item.short}
            </Link>
          );
        })}
      </nav>
    </div>
  );
}
