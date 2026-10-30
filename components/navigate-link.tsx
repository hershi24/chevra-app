import { Navigation } from "lucide-react";
import { cn } from "@/lib/utils";

export function wazeUrl(location: string) {
  return `https://waze.com/ul?q=${encodeURIComponent(location.trim())}&navigate=yes`;
}

export function NavigateLink({
  location,
  className,
}: {
  location: string;
  className?: string;
}) {
  const query = location.trim();
  if (!query) return null;
  return (
    <a
      href={wazeUrl(query)}
      target="_blank"
      rel="noreferrer"
      className={cn(
        "relative z-10 inline-flex shrink-0 items-center gap-1 rounded-full bg-[#f5f0e7] px-2.5 py-1 text-[12px] text-[#7d5a22]",
        className
      )}
    >
      <Navigation className="size-3.5" aria-hidden />
      ניווט
    </a>
  );
}
