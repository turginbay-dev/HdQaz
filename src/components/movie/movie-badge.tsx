import { cn } from "@/lib/cn";
import type { MovieLocalization } from "@/types/movie";

type MovieBadgeProps = {
  label: MovieLocalization | "Premium" | "1080p" | "Жаңа";
};

export function MovieBadge({ label }: MovieBadgeProps) {
  const isGold = label === "Қазақша дыбыстама" || label === "Premium";

  return (
    <span
      className={cn(
        "inline-flex rounded-full border px-3 py-1 text-xs font-semibold",
        isGold
          ? "border-[rgba(217,183,111,0.4)] bg-[rgba(217,183,111,0.2)] text-[var(--accent)]"
          : "border-white/15 bg-white/10 text-zinc-100"
      )}
    >
      {label}
    </span>
  );
}
