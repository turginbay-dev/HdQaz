import type { MouseEventHandler } from "react";
import Image from "next/image";
import Link from "next/link";
import { cn } from "@/lib/cn";

type LogoMarkProps = {
  className?: string;
  imageClassName?: string;
  priority?: boolean;
  sizes?: string;
};

type SiteLogoProps = {
  className?: string;
  href?: string;
  markClassName?: string;
  onClick?: MouseEventHandler<HTMLAnchorElement>;
  priority?: boolean;
  variant?: "desktop" | "mobile" | "drawer" | "footer";
};

const logoVariants = {
  desktop: {
    link: "group inline-flex h-14 w-[4.25rem] items-center justify-center rounded-full transition hover:scale-[1.03] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent)]",
    mark: "h-[52px] w-[52px]",
    sizes: "52px"
  },
  mobile: {
    link: "glass group inline-flex h-14 w-[4.25rem] items-center justify-center rounded-full transition hover:scale-[1.03] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent)]",
    mark: "h-12 w-12",
    sizes: "48px"
  },
  drawer: {
    link: "group inline-flex h-12 w-12 items-center justify-center rounded-full transition hover:scale-[1.03] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent)]",
    mark: "h-12 w-12 p-0.5",
    sizes: "48px"
  },
  footer: {
    link: "group inline-flex h-24 w-24 items-center justify-center rounded-full transition hover:scale-[1.03] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent)]",
    mark: "h-24 w-24 p-2",
    sizes: "96px"
  }
} as const;

export function LogoMark({
  className,
  imageClassName,
  priority = false,
  sizes = "64px"
}: LogoMarkProps) {
  return (
    <span
      className={cn(
        "relative inline-flex shrink-0 items-center justify-center overflow-hidden rounded-full border border-white/[0.16] bg-white/[0.07] p-1 shadow-[0_16px_48px_rgba(0,0,0,0.42),0_0_34px_rgba(217,183,111,0.18)] ring-1 ring-black/20",
        className
      )}
    >
      <span className="absolute inset-0 rounded-full bg-[radial-gradient(circle_at_34%_18%,rgba(255,255,255,0.28),transparent_34%),radial-gradient(circle_at_68%_80%,rgba(217,183,111,0.2),transparent_40%)]" />
      <Image
        src="/Logo.png"
        alt=""
        width={1024}
        height={1024}
        priority={priority}
        sizes={sizes}
        className={cn(
          "relative z-10 h-full w-full object-contain drop-shadow-[0_10px_18px_rgba(0,0,0,0.45)]",
          imageClassName
        )}
      />
    </span>
  );
}

export function SiteLogo({
  className,
  href = "/",
  markClassName,
  onClick,
  priority = false,
  variant = "desktop"
}: SiteLogoProps) {
  const config = logoVariants[variant];

  return (
    <Link
      href={href}
      aria-label="HdQaz басты бет"
      onClick={onClick}
      className={cn(config.link, className)}
    >
      <LogoMark
        className={cn(config.mark, markClassName)}
        priority={priority}
        sizes={config.sizes}
      />
      <span className="sr-only">HdQaz</span>
    </Link>
  );
}
