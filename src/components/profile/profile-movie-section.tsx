"use client";

import Link from "next/link";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { HeartOff, Trash2 } from "lucide-react";
import { MovieCard } from "@/components/movie/movie-card";
import type { Movie } from "@/types/movie";

type ProfileMovieSectionProps = {
  emptyCta?: boolean;
  movies: Movie[];
  title: string;
  variant?: "likes" | "watchlist";
};

async function readApiError(response: Response, fallback: string) {
  const result = (await response.json().catch(() => null)) as { error?: { message?: string } } | null;

  return result?.error?.message ?? fallback;
}

export function ProfileMovieSection({ emptyCta = false, movies, title, variant }: ProfileMovieSectionProps) {
  const router = useRouter();
  const [items, setItems] = useState(movies);
  const [pendingSlug, setPendingSlug] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function removeMovie(movie: Movie) {
    if (!variant) {
      return;
    }

    setPendingSlug(movie.slug);
    setError(null);

    try {
      const endpoint =
        variant === "watchlist"
          ? `/api/watchlist/${encodeURIComponent(movie.slug)}`
          : `/api/engagement/likes/${encodeURIComponent(movie.slug)}`;
      const response = await fetch(endpoint, { method: "DELETE" });

      if (!response.ok) {
        throw new Error(await readApiError(response, "Өшіру мүмкін болмады"));
      }

      setItems((current) => current.filter((item) => item.id !== movie.id));
      router.refresh();
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Өшіру мүмкін болмады");
    } finally {
      setPendingSlug(null);
    }
  }

  return (
    <section className="glass rounded-[30px] p-5 sm:p-6">
      <div className="mb-5 flex items-center justify-between gap-4">
        <div>
          <h2 className="text-xl font-bold tracking-[-0.018em] text-white">{title}</h2>
          <div className="mt-2 h-px w-20 bg-gradient-to-r from-[var(--accent)] to-transparent" />
        </div>
        <span className="rounded-full border border-white/10 bg-white/[0.06] px-3 py-1 text-xs font-semibold text-zinc-400">
          {items.length}
        </span>
      </div>

      {items.length > 0 ? (
        <div className="grid grid-cols-2 gap-x-4 gap-y-8 sm:grid-cols-3 xl:grid-cols-4">
          {items.map((movie) => (
            <div key={movie.id} className="relative">
              <MovieCard movie={movie} />
              {variant ? (
                <button
                  className="glass-button mt-3 inline-flex min-h-10 w-full items-center justify-center gap-2 rounded-full px-3 text-xs font-bold text-white disabled:cursor-wait disabled:opacity-60"
                  type="button"
                  disabled={pendingSlug === movie.slug}
                  onClick={() => removeMovie(movie)}
                >
                  {variant === "watchlist" ? <Trash2 className="h-4 w-4" /> : <HeartOff className="h-4 w-4" />}
                  Өшіру
                </button>
              ) : null}
            </div>
          ))}
        </div>
      ) : (
        <div className="rounded-[24px] border border-white/10 bg-black/20 px-5 py-8 text-center">
          <p className="text-sm font-semibold text-zinc-300">Әзірге ештеңе жоқ</p>
          {emptyCta ? (
            <Link
              href="/catalog"
              className="glass-button mt-4 inline-flex min-h-11 items-center justify-center rounded-full px-4 text-sm font-bold text-white"
            >
              Каталогқа өту
            </Link>
          ) : null}
        </div>
      )}

      {error ? <p className="mt-3 text-sm font-medium text-[var(--accent)]">{error}</p> : null}
    </section>
  );
}
