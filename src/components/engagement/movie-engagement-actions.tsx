"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Bookmark, Heart, Loader2, MessageCircle } from "lucide-react";
import { cn } from "@/lib/cn";

type MovieEngagementActionsProps = {
  initialLiked: boolean;
  initialWatchlisted: boolean;
  isAuthenticated: boolean;
  movieSlug: string;
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
  movieSlug
}: MovieEngagementActionsProps) {
  const router = useRouter();
  const [liked, setLiked] = useState(initialLiked);
  const [watchlisted, setWatchlisted] = useState(initialWatchlisted);
  const [pending, setPending] = useState<PendingAction>(null);
  const [message, setMessage] = useState<string | null>(null);

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
      setMessage(error instanceof Error ? error.message : "Тізімді сақтау мүмкін болмады");
    } finally {
      setPending(null);
    }
  }

  function focusComments() {
    document.getElementById("comments")?.scrollIntoView({
      behavior: "smooth",
      block: "start"
    });
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

        <button
          className="glass-button inline-flex min-h-12 items-center justify-center gap-2 rounded-full px-5 text-sm font-bold tracking-[0.014em] text-white"
          type="button"
          onClick={focusComments}
        >
          <MessageCircle className="h-4 w-4" />
          Пікір жазу
        </button>
      </div>

      {message ? <p className="px-1 text-xs font-medium tracking-[0.004em] text-[var(--accent)]">{message}</p> : null}
    </div>
  );
}
