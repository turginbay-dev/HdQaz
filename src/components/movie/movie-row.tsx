import Link from "next/link";
import { MovieCard } from "@/components/movie/movie-card";
import { Reveal } from "@/components/motion/reveal";
import type { Movie } from "@/types/movie";

type MovieRowProps = {
  href?: string | { pathname: string; query?: Record<string, string> };
  title: string;
  movies: Movie[];
};

export function MovieRow({ href = "/catalog", title, movies }: MovieRowProps) {
  return (
    <Reveal>
      <section className="relative">
        <div className="mb-5 flex items-center justify-between gap-4">
          <div>
            <h2 className="text-2xl font-semibold tracking-tight text-white sm:text-3xl">
              {title}
            </h2>
            <div className="mt-2 h-px w-24 bg-gradient-to-r from-[var(--accent)] to-transparent" />
          </div>
          <Link
            href={href}
            className="glass-button rounded-full px-4 py-2 text-sm font-medium text-white"
          >
            Барлығы
          </Link>
        </div>
        <div className="cinema-mask hide-scrollbar -mx-4 flex gap-4 overflow-x-auto px-4 pb-8 pt-1 sm:-mx-6 sm:px-6 lg:-mx-8 lg:px-8">
          {movies.map((movie, index) => (
            <div key={movie.id} className="w-40 shrink-0 sm:w-48 lg:w-56">
              <MovieCard movie={movie} priority={index < 2} />
            </div>
          ))}
        </div>
      </section>
    </Reveal>
  );
}
