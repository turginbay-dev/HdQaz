import Link from "next/link";
import { MovieCard } from "@/components/movie/movie-card";
import { Reveal } from "@/components/motion/reveal";
import type { Movie } from "@/types/movie";

type MovieRowProps = {
  href?: string | { pathname: string; query?: Record<string, string> };
  title: string;
  movies: Movie[];
  priorityCount?: number;
};

export function MovieRow({ href = "/catalog", title, movies, priorityCount = 0 }: MovieRowProps) {
  if (movies.length === 0) {
    return null;
  }

  return (
    <Reveal>
      <section className="content-rail-section relative">
        <div className="mb-5 flex items-center justify-between gap-4">
          <div>
            <h2 className="text-2xl font-bold tracking-[-0.024em] text-white sm:text-3xl">
              {title}
            </h2>
            <div className="mt-2 h-px w-24 bg-gradient-to-r from-[var(--accent)] to-transparent" />
          </div>
          <Link
            href={href}
            className="glass-button rounded-full px-4 py-2 text-sm font-semibold tracking-[0.01em] text-white"
          >
            Барлығы
          </Link>
        </div>
        <div className="cinema-mask performance-rail hide-scrollbar -mx-4 flex snap-x snap-mandatory gap-4 overflow-x-auto overscroll-x-contain scroll-smooth px-4 pb-8 pt-1 sm:-mx-6 sm:px-6 lg:-mx-8 lg:px-8">
          {movies.map((movie, index) => (
            <div
              key={movie.id}
              className="w-[42vw] min-w-[9.75rem] shrink-0 snap-start sm:w-44 lg:w-52 xl:w-56"
            >
              <MovieCard movie={movie} priority={index < priorityCount} eager={index < 8} />
            </div>
          ))}
        </div>
      </section>
    </Reveal>
  );
}
