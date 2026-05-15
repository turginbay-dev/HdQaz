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

const BRAND_LOGO_SRC = "/Logo.PNG";

const logoVariants = {
  desktop: {
    link: "group inline-flex h-14 w-[6.25rem] items-center justify-center rounded-[24px] transition hover:scale-[1.03] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent)]",
    mark: "h-[52px] w-[78px] p-1",
    sizes: "78px"
  },
  mobile: {
    link: "glass group inline-flex h-14 w-[6rem] items-center justify-center rounded-[24px] transition hover:scale-[1.03] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent)]",
    mark: "h-12 w-[72px] p-1",
    sizes: "72px"
  },
  drawer: {
    link: "group inline-flex h-12 w-[5.5rem] items-center justify-center rounded-[22px] transition hover:scale-[1.03] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent)]",
    mark: "h-12 w-[72px] p-1",
    sizes: "72px"
  },
  footer: {
    link: "group inline-flex h-20 w-32 items-center justify-center rounded-[28px] transition hover:scale-[1.03] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent)]",
    mark: "h-20 w-32 p-2",
    sizes: "128px"
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
        "relative inline-flex shrink-0 items-center justify-center overflow-hidden rounded-[18px] border border-white/[0.16] bg-white/[0.07] shadow-[0_16px_48px_rgba(0,0,0,0.42),0_0_34px_rgba(217,183,111,0.18)] ring-1 ring-black/20",
        className
      )}
    >
      <span className="absolute inset-0 rounded-[inherit] bg-[radial-gradient(circle_at_34%_18%,rgba(255,255,255,0.24),transparent_34%),radial-gradient(circle_at_68%_80%,rgba(217,183,111,0.18),transparent_40%)]" />
      <Image
        src={BRAND_LOGO_SRC}
        alt=""
        width={1536}
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
