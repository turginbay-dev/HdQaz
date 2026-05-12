import Link from "next/link";
import type { MouseEventHandler, ReactNode } from "react";
import { cn } from "@/lib/cn";

type PremiumButtonProps = {
  children: ReactNode;
  href?: string;
  variant?: "primary" | "glass";
  className?: string;
  onClick?: MouseEventHandler<HTMLButtonElement>;
  type?: "button" | "submit" | "reset";
  disabled?: boolean;
};

export function PremiumButton({
  children,
  href,
  variant = "primary",
  className,
  onClick,
  type = "button",
  disabled = false
}: PremiumButtonProps) {
  const classes = cn(
    "cinema-sweep inline-flex min-h-12 items-center justify-center gap-2 rounded-full px-5 text-sm font-semibold outline-none transition focus-visible:ring-2 focus-visible:ring-[var(--accent)] sm:min-h-14 sm:px-6",
    variant === "primary"
      ? "bg-white text-black shadow-[0_18px_70px_rgba(255,255,255,0.18)] hover:bg-[#f3ead5]"
      : "glass-button text-white shadow-[0_18px_70px_rgba(0,0,0,0.28)]",
    className
  );

  if (href) {
    return (
      <Link href={href} className={classes}>
        {children}
      </Link>
    );
  }

  return (
    <button
      className={classes}
      disabled={disabled}
      onClick={onClick}
      type={type}
    >
      {children}
    </button>
  );
}
