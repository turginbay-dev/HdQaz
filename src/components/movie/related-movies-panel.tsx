import Link from "next/link";
import { Film, Radio } from "lucide-react";
import { GlassPanel } from "@/components/glass/glass-panel";
import { MovieImage } from "@/components/movie/movie-image";
import { contentStatusLabels, contentTypeLabels, formatDurationMinutes, formatEpisodeCount, isEpisodicContent } from "@/features/content/format";
import { cn } from "@/lib/cn";
import type { Movie } from "@/types/movie";

type RelatedMoviesPanelProps = {
  className?: string;
  current: Movie;
  movies: Movie[];
  title?: string;
};

export function RelatedMoviesPanel({
  className,
  current,
  movies,
  title = "Ұқсас контент"
}: RelatedMoviesPanelProps) {
  if (movies.length === 0) {
    return null;
  }

  const typeLabel = current.type ? contentTypeLabels[current.type] : "Movie";
  const subtitle = [typeLabel, current.genres[0]].filter(Boolean).join(" · ");

  return (
    <GlassPanel className={cn("p-4 sm:p-5", className)}>
      <div className="mb-4 flex items-center justify-between gap-3">
        <div className="min-w-0">
          <p className="text-[10px] font-semibold uppercase tracking-[0.2em] text-zinc-500">
            Формат және жанр
          </p>
          <h2 className="mt-1 text-lg font-semibold tracking-tight text-white">{title}</h2>
          <p className="mt-1 truncate text-xs font-medium text-[rgba(217,183,111,0.82)]">{subtitle}</p>
        </div>
        <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full border border-white/10 bg-white/[0.07] text-[var(--accent)]">
          <Film className="h-5 w-5" />
        </span>
      </div>

      <div className="space-y-3">
        {movies.slice(0, 6).map((movie, index) => (
          <RelatedMovieLink key={movie.id} movie={movie} priority={index < 2} />
        ))}
      </div>
    </GlassPanel>
  );
}

function RelatedMovieLink({ movie, priority }: { movie: Movie; priority: boolean }) {
  const typeLabel = movie.type ? contentTypeLabels[movie.type] : "Movie";
  const statusLabel = movie.status ? contentStatusLabels[movie.status] : movie.isNewRelease ? "Жаңа" : "Аяқталған";
  const detailLine = isEpisodicContent(movie)
    ? formatEpisodeCount(movie.episodeCount) || "Сериялар"
    : formatDurationMinutes(movie.durationMinutes) || movie.runtime;
  const metaLine = [typeLabel, movie.genres[0], statusLabel].filter(Boolean).join(" · ");

  return (
    <Link
      href={`/${movie.slug}`}
      className="group grid grid-cols-[4.5rem_minmax(0,1fr)] gap-3 rounded-2xl border border-white/10 bg-white/[0.035] p-2 transition hover:border-[rgba(217,183,111,0.34)] hover:bg-white/[0.07]"
    >
      <div className="relative aspect-[2/3] overflow-hidden rounded-xl bg-black">
        <MovieImage
          src={movie.posterUrl}
          alt={movie.title}
          fallback="poster"
          fill
          priority={priority}
          sizes="72px"
          className="object-cover transition duration-500 group-hover:scale-105"
        />
      </div>
      <div className="min-w-0 py-1">
        <h3 className="line-clamp-2 text-sm font-semibold leading-5 text-white">{movie.title}</h3>
        <p className="mt-1 truncate text-xs text-zinc-400">{metaLine}</p>
        <p className="mt-2 flex items-center gap-1.5 text-xs font-medium text-[rgba(217,183,111,0.82)]">
          <Radio className="h-3 w-3 shrink-0" />
          <span className="truncate">{movie.dubber?.name ? `${movie.dubber.name} · ${detailLine}` : detailLine}</span>
        </p>
      </div>
    </Link>
  );
}
