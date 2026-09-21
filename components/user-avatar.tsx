"use client";

import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { cn } from "@/lib/utils";
import type { Member } from "@/lib/types";

export function UserAvatar({
  member,
  size = "default",
  className,
}: {
  member?: Pick<Member, "displayName" | "initials" | "avatarColor"> | null;
  size?: "default" | "sm" | "lg";
  className?: string;
}) {
  return (
    <Avatar size={size} className={className}>
      <AvatarFallback
        className={cn("text-white font-medium")}
        style={{ background: member?.avatarColor ?? "#0F766E" }}
      >
        {member?.initials ?? "?"}
      </AvatarFallback>
    </Avatar>
  );
}
