import type { EngagementStats } from "@/features/engagement/types";
import { formatViewCount } from "@/lib/formatters";

type AdminStatsPillsProps = {
  stats: EngagementStats;
};

export function AdminStatsPills({ stats }: AdminStatsPillsProps) {
  const items = [
    ["Қаралым", stats.views],
    ["Ұнату", stats.likes],
    ["Пікір", stats.comments],
    ["Тізімге қосқан", stats.watchlist]
  ] as const;

  return (
    <div className="flex flex-wrap gap-2">
      {items.map(([label, value]) => (
        <span
          key={label}
          className="rounded-full border border-white/10 bg-black/25 px-3 py-1.5 text-[11px] font-semibold tracking-[0.01em] text-zinc-300 backdrop-blur-2xl"
        >
          {label}: <span className="text-white">{formatViewCount(value)}</span>
        </span>
      ))}
    </div>
  );
}
