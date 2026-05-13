import Link from "next/link";
import { Play } from "lucide-react";
import { cn } from "@/lib/cn";

type WatchButtonProps = {
  className?: string;
  href: string;
  label?: string;
};

export function WatchButton({ className, href, label = "Көру" }: WatchButtonProps) {
  return (
    <Link
      href={href}
      className={cn(
        "hero-watch-button inline-flex min-h-12 items-center justify-center gap-2 rounded-full px-5 text-sm font-bold tracking-[0.014em] outline-none transition focus-visible:ring-2 focus-visible:ring-[var(--accent)] sm:min-h-14 sm:px-6",
        className
      )}
    >
      <Play className="h-4 w-4 fill-current" />
      {label}
    </Link>
  );
}
