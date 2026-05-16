"use client";

import Link from "next/link";
import { Play, Radio } from "lucide-react";
import { MovieBadge } from "@/components/movie/movie-badge";
import { MovieImage } from "@/components/movie/movie-image";
import { contentStatusLabels, contentTypeLabels, formatDurationMinutes, formatEpisodeCount, isEpisodicContent } from "@/features/content/format";
import type { Movie } from "@/types/movie";

type MovieCardProps = {
  movie: Movie;
  priority?: boolean;
};

export function MovieCard({ movie, priority = false }: MovieCardProps) {
  const typeLabel = movie.type ? contentTypeLabels[movie.type] : "Фильм";
  const statusLabel = movie.status ? contentStatusLabels[movie.status] : movie.isNewRelease ? "Жаңа" : "Аяқталған";
  const detailLine = isEpisodicContent(movie)
    ? formatEpisodeCount(movie.episodeCount) || "Сериялар жақында"
    : formatDurationMinutes(movie.durationMinutes) || movie.runtime;

  return (
    <div className="movie-card group relative transition duration-300 hover:-translate-y-2">
      <Link href={`/${movie.slug}`} className="block outline-none">
        <article className="movie-card-article relative overflow-hidden rounded-[24px] border border-white/10 bg-white/[0.045] shadow-[0_24px_80px_rgba(0,0,0,0.28)] transition duration-500 group-hover:border-[rgba(217,183,111,0.35)] group-hover:shadow-[0_28px_110px_rgba(217,183,111,0.14)]">
          <div className="poster-reflection movie-card-poster relative aspect-[2/3] overflow-hidden rounded-[24px]">
            <MovieImage
              src={movie.posterUrl}
              alt={movie.title}
              fallback="poster"
              fill
              priority={priority}
              sizes="(max-width: 640px) 42vw, (max-width: 1024px) 24vw, 220px"
              className="movie-card-image object-cover transition duration-700 ease-out group-hover:scale-110"
            />
          </div>

          <div className="movie-card-base-overlay absolute inset-0 bg-gradient-to-t from-black via-black/20 to-transparent opacity-[0.76] transition duration-500 group-hover:opacity-95" />
          <div className="movie-card-hover-layer absolute inset-0 opacity-0 transition duration-500 group-hover:opacity-100">
            <div className="absolute inset-x-0 top-0 h-28 bg-gradient-to-b from-[rgba(217,183,111,0.18)] to-transparent" />
            <div className="absolute inset-0 ring-1 ring-inset ring-white/10" />
          </div>

          <div className="absolute left-3 right-3 top-3 flex items-center justify-between">
            <span className="glass rounded-full px-2.5 py-1 text-[11px] font-bold tracking-[0.012em] text-white">
              {movie.year}
            </span>
            <MovieBadge label={typeLabel} />
          </div>

          <div className="movie-card-hover-panel absolute inset-x-3 bottom-3 translate-y-4 opacity-0 transition duration-500 group-hover:translate-y-0 group-hover:opacity-100">
            <div className="movie-card-detail-glass glass rounded-[20px] p-3">
              <div className="mb-2 flex flex-wrap gap-1.5">
                <MovieBadge label={statusLabel} />
                {movie.genres[0] && (
                  <span className="rounded-full border border-white/10 bg-white/[0.08] px-2.5 py-1 text-[11px] font-semibold tracking-[0.01em] text-zinc-200">
                    {movie.genres[0]}
                  </span>
                )}
              </div>
              <div className="flex items-end justify-between gap-3">
                <div className="min-w-0">
                  <h3 className="truncate text-sm font-bold tracking-[-0.012em] text-white">
                    {movie.title}
                  </h3>
                  <p className="mt-1 flex items-center gap-1 text-xs font-medium tracking-[0.004em] text-zinc-300">
                    <Radio className="h-3 w-3 text-[var(--accent)]" />
                    {movie.dubber?.name ?? statusLabel} · {detailLine}
                  </p>
                </div>
                <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-white text-black shadow-[0_12px_35px_rgba(255,255,255,0.22)]">
                  <Play className="h-4 w-4 fill-current" />
                </span>
              </div>
            </div>
          </div>
        </article>

        <div className="mt-3 px-1">
          <h3 className="truncate text-sm font-bold tracking-[-0.012em] text-white">
            {movie.title}
          </h3>
          <p className="mt-1 truncate text-xs font-medium tracking-[0.004em] text-zinc-500">
            {typeLabel} · {statusLabel}
          </p>
          <p className="mt-1 truncate text-[11px] font-semibold tracking-[0.008em] text-[rgba(217,183,111,0.82)]">
            {movie.dubber?.name ? `${movie.dubber.name} · ${detailLine}` : detailLine}
          </p>
        </div>
      </Link>
    </div>
  );
}
