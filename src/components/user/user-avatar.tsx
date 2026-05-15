import Image from "next/image";
import { cn } from "@/lib/cn";

type UserAvatarProps = {
  avatarUrl?: string | null;
  className?: string;
  displayName?: string | null;
  priority?: boolean;
  sizes?: string;
};

const DEFAULT_AVATAR_SRC = "/Avatar.PNG";

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
  const frameClassName = cn(
    "relative inline-flex shrink-0 overflow-hidden rounded-full border border-white/10 bg-white/10 shadow-[0_12px_34px_rgba(0,0,0,0.32)]",
    className
  );

  if (trimmedAvatar) {
    return (
      <span className={frameClassName}>
        <img
          src={trimmedAvatar}
          alt={alt}
          className="h-full w-full object-cover"
          loading={priority ? "eager" : "lazy"}
        />
      </span>
    );
  }

  return (
    <span className={frameClassName}>
      <Image
        src={DEFAULT_AVATAR_SRC}
        alt={alt}
        fill
        priority={priority}
        sizes={sizes}
        className="object-cover"
      />
      <span className="sr-only">{getInitials(displayName)}</span>
    </span>
  );
}
