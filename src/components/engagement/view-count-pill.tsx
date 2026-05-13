import { Eye } from "lucide-react";
import { cn } from "@/lib/cn";
import { formatViewLabel } from "@/lib/formatters";

type ViewCountPillProps = {
  className?: string;
  compact?: boolean;
  views: number;
};

export function ViewCountPill({ className, compact = false, views }: ViewCountPillProps) {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/[0.08] px-3 py-1.5 text-xs font-semibold tracking-[0.01em] text-zinc-200 backdrop-blur-2xl",
        className
      )}
    >
      <Eye className="h-3.5 w-3.5 text-[var(--accent)]" />
      {formatViewLabel(views, { compact })}
    </span>
  );
}
