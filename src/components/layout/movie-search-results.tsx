"use client";

import { useEffect, useState } from "react";
import { MovieImage } from "@/components/movie/movie-image";
import { contentStatusLabels, contentTypeLabels, formatDurationMinutes, formatEpisodeCount, isEpisodicContent } from "@/features/content/format";
import { cn } from "@/lib/cn";
import type { Movie } from "@/types/movie";

type SearchResponse = {
  data?: {
    items?: Movie[];
  };
};

type MovieSearchResultsProps = {
  loading: boolean;
  onSelect: (slug: string) => void;
  query: string;
  results: Movie[];
  variant: "desktop" | "mobile";
};

function getMovieMeta(movie: Movie) {
  const typeLabel = movie.type ? contentTypeLabels[movie.type] : "Фильм";
  const statusLabel = movie.status ? contentStatusLabels[movie.status] : movie.isNewRelease ? "Жаңа" : "Аяқталған";
  const lengthLabel = isEpisodicContent(movie)
    ? formatEpisodeCount(movie.episodeCount)
    : formatDurationMinutes(movie.durationMinutes) || movie.runtime;

  return [typeLabel, movie.year ? String(movie.year) : "", statusLabel, lengthLabel, movie.dubber?.name ?? ""]
    .filter(Boolean)
    .join(" · ");
}

function normalizeSearchText(value: string) {
  return value.trim().toLocaleLowerCase("kk-KZ");
}

function sortSearchResults(results: Movie[], query: string) {
  const normalizedQuery = normalizeSearchText(query);

  function score(movie: Movie) {
    const title = normalizeSearchText(movie.title);
    const originalTitle = normalizeSearchText(movie.originalTitle);

    if (title === normalizedQuery) return 0;
    if (title.startsWith(normalizedQuery)) return 1;
    if (originalTitle.startsWith(normalizedQuery)) return 2;
    if (title.includes(normalizedQuery)) return 3;
    if (originalTitle.includes(normalizedQuery)) return 4;

    return 5;
  }

  return [...results].sort((left, right) => score(left) - score(right) || left.title.localeCompare(right.title, "kk-KZ"));
}

export function useMovieSearch(query: string, enabled: boolean, limit = 50) {
  const [loading, setLoading] = useState(false);
  const [results, setResults] = useState<Movie[]>([]);

  useEffect(() => {
    const trimmedQuery = query.trim();

    if (!enabled || !trimmedQuery) {
      setResults([]);
      setLoading(false);
      return;
    }

    const controller = new AbortController();
    const timeout = window.setTimeout(async () => {
      setLoading(true);

      try {
        const response = await fetch(`/api/movies?q=${encodeURIComponent(trimmedQuery)}&limit=${limit}`, {
          signal: controller.signal
        });

        if (!response.ok) {
          setResults([]);
          return;
        }

        const payload = (await response.json()) as SearchResponse;
        setResults(sortSearchResults(payload.data?.items ?? [], trimmedQuery));
      } catch (error) {
        if (!controller.signal.aborted) {
          setResults([]);
        }
      } finally {
        if (!controller.signal.aborted) {
          setLoading(false);
        }
      }
    }, 180);

    return () => {
      controller.abort();
      window.clearTimeout(timeout);
    };
  }, [enabled, limit, query]);

  return {
    loading,
    results
  };
}

export function MovieSearchResults({
  loading,
  onSelect,
  query,
  results,
  variant
}: MovieSearchResultsProps) {
  if (!query.trim()) {
    return null;
  }

  const desktop = variant === "desktop";

  return (
    <div className={cn(desktop ? "desktop-search-results" : "mobile-search-results", "mt-3")}>
      {loading ? (
        <div className={desktop ? "desktop-search-state" : "mobile-search-state"}>Ізделіп жатыр...</div>
      ) : results.length > 0 ? (
        results.map((movie) => (
          <button
            key={movie.id}
            className={desktop ? "desktop-search-result" : "mobile-search-result"}
            type="button"
            onMouseDown={(event) => event.preventDefault()}
            onClick={() => onSelect(movie.slug)}
          >
            <span
              className={cn(
                "relative shrink-0 overflow-hidden bg-white/10",
                desktop ? "h-20 w-14 rounded-[14px]" : "h-14 w-10 rounded-[10px]"
              )}
            >
              <MovieImage
                src={movie.posterUrl}
                alt={movie.title}
                fallback="poster"
                fill
                sizes={desktop ? "56px" : "40px"}
                className="object-cover"
              />
            </span>
            <span className="min-w-0 flex-1 text-left">
              <span className={cn("block truncate font-bold tracking-[-0.006em] text-white", desktop ? "text-base" : "text-sm")}>
                {movie.title}
              </span>
              <span className={cn("mt-1 block truncate font-medium tracking-[0.004em] text-zinc-400", desktop ? "text-sm" : "text-xs")}>
                {getMovieMeta(movie)}
              </span>
              {movie.genres[0] ? (
                <span className={cn("mt-1 block truncate font-semibold tracking-[0.006em] text-[rgba(217,183,111,0.82)]", desktop ? "text-xs" : "text-[11px]")}>
                  {movie.genres.slice(0, 3).join(" · ")}
                </span>
              ) : null}
            </span>
          </button>
        ))
      ) : (
        <div className={desktop ? "desktop-search-state" : "mobile-search-state"}>Ештеңе табылмады</div>
      )}
    </div>
  );
}
