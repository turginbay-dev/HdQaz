import { cn } from "@/lib/cn";

type MovieBadgeProps = {
  label: string;
};

export function MovieBadge({ label }: MovieBadgeProps) {
  const isGold = label === "Қазақша дыбыстама" || label === "Premium";

  return (
    <span
      className={cn(
        "inline-flex rounded-full border px-3 py-1 text-xs font-bold tracking-[0.012em]",
        isGold
          ? "border-[rgba(217,183,111,0.4)] bg-[rgba(217,183,111,0.2)] text-[var(--accent)]"
          : "border-white/15 bg-white/10 text-zinc-100"
      )}
    >
      {label}
    </span>
  );
}
