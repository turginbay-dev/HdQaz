import Image from "next/image";
import { LogoMark } from "@/components/layout/site-logo";
import { cn } from "@/lib/cn";

type UserAvatarProps = {
  avatarUrl?: string | null;
  className?: string;
  displayName?: string | null;
  priority?: boolean;
  sizes?: string;
};

function getInitials(value?: string | null) {
  const parts = value?.trim().split(/\s+/).filter(Boolean) ?? [];

  if (parts.length === 0) {
    return "H";
  }

  return parts.slice(0, 2).map((part) => part[0]?.toUpperCase()).join("");
}

export function UserAvatar({
  avatarUrl,
  className,
  displayName,
  priority = false,
  sizes = "48px"
}: UserAvatarProps) {
  const trimmedAvatar = avatarUrl?.trim();
  const alt = displayName?.trim() || "HdQaz қолданушысы";

  if (trimmedAvatar) {
    return (
      <span
        className={cn(
          "relative inline-flex shrink-0 overflow-hidden rounded-full border border-white/10 bg-white/10",
          className
        )}
      >
        <Image
          src={trimmedAvatar}
          alt={alt}
          fill
          priority={priority}
          sizes={sizes}
          className="object-cover"
        />
      </span>
    );
  }

  return (
    <span className={cn("relative inline-flex shrink-0", className)}>
      <LogoMark className="h-full w-full p-1" sizes={sizes} priority={priority} />
      <span className="sr-only">{getInitials(displayName)}</span>
    </span>
  );
}
