"use client";

import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { cn } from "@/lib/utils";
import type { Member } from "@/lib/types";

export function UserAvatar({
  member,
  size = "default",
  className,
}: {
  member?: Pick<Member, "displayName" | "initials" | "avatarColor" | "avatarUrl"> | null;
  size?: "default" | "sm" | "lg";
  className?: string;
}) {
  return (
    <Avatar size={size} className={className}>
      {member?.avatarUrl ? (
        <AvatarImage src={member.avatarUrl} alt="" referrerPolicy="no-referrer" />
      ) : null}
      <AvatarFallback
        className={cn("text-white font-medium")}
        style={{ background: member?.avatarColor ?? "#0F766E" }}
      >
        {member?.initials ?? "?"}
      </AvatarFallback>
    </Avatar>
  );
}
