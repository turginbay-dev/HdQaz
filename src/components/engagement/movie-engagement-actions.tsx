"use client";

import { type ReactNode, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Bookmark, Eye, Heart, Loader2 } from "lucide-react";
import type { EngagementStats } from "@/features/engagement/types";
import { cn } from "@/lib/cn";
import { formatCompactCount } from "@/lib/formatters";

type MovieEngagementActionsProps = {
  initialLiked: boolean;
  initialWatchlisted: boolean;
  isAuthenticated: boolean;
  movieSlug: string;
  stats?: EngagementStats;
  variant?: "buttons" | "player-row";
};

type PendingAction = "like" | "watchlist" | null;

async function readApiError(response: Response, fallback: string) {
  const result = (await response.json().catch(() => null)) as { error?: { message?: string } } | null;

  return result?.error?.message ?? fallback;
}

export function MovieEngagementActions({
  initialLiked,
  initialWatchlisted,
  isAuthenticated,
  movieSlug,
  stats,
  variant = "buttons"
}: MovieEngagementActionsProps) {
  const router = useRouter();
  const [liked, setLiked] = useState(initialLiked);
  const [watchlisted, setWatchlisted] = useState(initialWatchlisted);
  const [counts, setCounts] = useState(() => ({
    likes: stats?.likes ?? 0,
    views: stats?.views ?? 0,
    watchlist: stats?.watchlist ?? 0
  }));
  const [pending, setPending] = useState<PendingAction>(null);
  const [message, setMessage] = useState<string | null>(null);

  useEffect(() => {
    if (!stats) {
      return;
    }

    setCounts({
      likes: stats.likes,
      views: stats.views,
      watchlist: stats.watchlist
    });
  }, [stats]);

  function requireLogin() {
    setMessage("Кіру қажет");
    router.push("/login");
  }

  async function toggleLike() {
    if (!isAuthenticated) {
      requireLogin();
      return;
    }

    if (pending) {
      return;
    }

    const previous = liked;
    const next = !liked;
    setLiked(next);
    setCounts((current) => ({
      ...current,
      likes: Math.max(0, current.likes + (next ? 1 : -1))
    }));
    setPending("like");
    setMessage(null);

    try {
      const response = await fetch(next ? "/api/engagement/likes" : `/api/engagement/likes/${encodeURIComponent(movieSlug)}`, {
        method: next ? "POST" : "DELETE",
        headers: next ? { "Content-Type": "application/json" } : undefined,
        body: next ? JSON.stringify({ movieSlug }) : undefined
      });

      if (!response.ok) {
        throw new Error(await readApiError(response, "Ұнатуды сақтау мүмкін болмады"));
      }

      router.refresh();
    } catch (error) {
      setLiked(previous);
      setCounts((current) => ({
        ...current,
        likes: Math.max(0, current.likes + (next ? -1 : 1))
      }));
      setMessage(error instanceof Error ? error.message : "Ұнатуды сақтау мүмкін болмады");
    } finally {
      setPending(null);
    }
  }

  async function toggleWatchlist() {
    if (!isAuthenticated) {
      requireLogin();
      return;
    }

    if (pending) {
      return;
    }

    const previous = watchlisted;
    const next = !watchlisted;
    setWatchlisted(next);
    setCounts((current) => ({
      ...current,
      watchlist: Math.max(0, current.watchlist + (next ? 1 : -1))
    }));
    setPending("watchlist");
    setMessage(null);

    try {
      const response = await fetch(next ? "/api/watchlist" : `/api/watchlist/${encodeURIComponent(movieSlug)}`, {
        method: next ? "POST" : "DELETE",
        headers: next ? { "Content-Type": "application/json" } : undefined,
        body: next ? JSON.stringify({ movieSlug }) : undefined
      });

      if (!response.ok) {
        throw new Error(await readApiError(response, "Тізімді сақтау мүмкін болмады"));
      }

      router.refresh();
    } catch (error) {
      setWatchlisted(previous);
      setCounts((current) => ({
        ...current,
        watchlist: Math.max(0, current.watchlist + (next ? -1 : 1))
      }));
      setMessage(error instanceof Error ? error.message : "Тізімді сақтау мүмкін болмады");
    } finally {
      setPending(null);
    }
  }

  if (variant === "player-row") {
    return (
      <div className="mt-4 flex flex-wrap items-center gap-x-4 gap-y-3 px-1">
        <div className="flex min-w-0 items-center gap-4 sm:gap-5">
          <InlineStat icon={<Eye className="h-4 w-4" />} label="Қаралым" value={counts.views} />
          <InlineStat icon={<Heart className="h-4 w-4" />} label="Ұнату" value={counts.likes} />
          <InlineStat icon={<Bookmark className="h-4 w-4" />} label="Тізімге қосқан" value={counts.watchlist} />
        </div>

        <div className="ml-auto flex shrink-0 items-center gap-2">
          <button
            className={cn(
              "inline-flex h-11 w-11 items-center justify-center rounded-full border border-white/10 bg-white/[0.055] text-zinc-200 shadow-[0_12px_34px_rgba(0,0,0,0.28)] outline-none transition hover:-translate-y-0.5 hover:border-white/20 hover:bg-white/[0.1] hover:text-white focus-visible:ring-2 focus-visible:ring-[var(--accent)] disabled:cursor-wait disabled:opacity-70",
              liked && "border-[rgba(217,183,111,0.38)] bg-[rgba(217,183,111,0.14)] text-[var(--accent)]"
            )}
            type="button"
            disabled={pending !== null}
            onClick={toggleLike}
            aria-label={liked ? "Ұнатуды алып тастау" : "Ұнату"}
            aria-pressed={liked}
            title={liked ? "Ұнатуды алып тастау" : "Ұнату"}
          >
            {pending === "like" ? <Loader2 className="h-4 w-4 animate-spin" /> : <Heart className={cn("h-4 w-4", liked && "fill-current")} />}
          </button>

          <button
            className={cn(
              "inline-flex h-11 w-11 items-center justify-center rounded-full border border-white/10 bg-white/[0.055] text-zinc-200 shadow-[0_12px_34px_rgba(0,0,0,0.28)] outline-none transition hover:-translate-y-0.5 hover:border-white/20 hover:bg-white/[0.1] hover:text-white focus-visible:ring-2 focus-visible:ring-[var(--accent)] disabled:cursor-wait disabled:opacity-70",
              watchlisted && "border-[rgba(143,183,255,0.38)] bg-[rgba(143,183,255,0.14)] text-white"
            )}
            type="button"
            disabled={pending !== null}
            onClick={toggleWatchlist}
            aria-label={watchlisted ? "Тізімнен алып тастау" : "Тізімге қосу"}
            aria-pressed={watchlisted}
            title={watchlisted ? "Тізімнен алып тастау" : "Тізімге қосу"}
          >
            {pending === "watchlist" ? <Loader2 className="h-4 w-4 animate-spin" /> : <Bookmark className={cn("h-4 w-4", watchlisted && "fill-current")} />}
          </button>
        </div>

        {message ? <p className="basis-full text-xs font-medium tracking-[0.004em] text-[var(--accent)]">{message}</p> : null}
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-2">
      <div className="flex flex-wrap gap-3">
        <button
          className={cn(
            "glass-button inline-flex min-h-12 items-center justify-center gap-2 rounded-full px-5 text-sm font-bold tracking-[0.014em] text-white disabled:cursor-wait disabled:opacity-70",
            liked && "border-[rgba(217,183,111,0.36)] bg-[rgba(217,183,111,0.16)] text-[var(--accent)]"
          )}
          type="button"
          disabled={pending !== null}
          onClick={toggleLike}
          aria-pressed={liked}
        >
          {pending === "like" ? <Loader2 className="h-4 w-4 animate-spin" /> : <Heart className={cn("h-4 w-4", liked && "fill-current")} />}
          {liked ? "Ұнаған" : "Ұнады"}
        </button>

        <button
          className={cn(
            "glass-button inline-flex min-h-12 items-center justify-center gap-2 rounded-full px-5 text-sm font-bold tracking-[0.014em] text-white disabled:cursor-wait disabled:opacity-70",
            watchlisted && "border-[rgba(143,183,255,0.36)] bg-[rgba(143,183,255,0.14)] text-white"
          )}
          type="button"
          disabled={pending !== null}
          onClick={toggleWatchlist}
          aria-pressed={watchlisted}
        >
          {pending === "watchlist" ? <Loader2 className="h-4 w-4 animate-spin" /> : <Bookmark className={cn("h-4 w-4", watchlisted && "fill-current")} />}
          {watchlisted ? "Тізімде" : "Тізімге қосу"}
        </button>
      </div>

      {message ? <p className="px-1 text-xs font-medium tracking-[0.004em] text-[var(--accent)]">{message}</p> : null}
    </div>
  );
}

function InlineStat({
  icon,
  label,
  value
}: {
  icon: ReactNode;
  label: string;
  value: number;
}) {
  return (
    <span className="inline-flex min-h-10 items-center gap-2 text-sm font-semibold tracking-[0.004em] text-zinc-300" title={label}>
      <span className="text-[var(--accent)]" aria-hidden="true">
        {icon}
      </span>
      <span aria-label={`${label}: ${formatCompactCount(value)}`}>{formatCompactCount(value)}</span>
    </span>
  );
}
