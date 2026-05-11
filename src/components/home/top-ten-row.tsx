import { MovieCard } from "@/components/movie/movie-card";
import { Reveal } from "@/components/motion/reveal";
import type { Movie } from "@/types/movie";

type TopTenRowProps = {
  movies: Movie[];
};

export function TopTenRow({ movies }: TopTenRowProps) {
  return (
    <Reveal>
      <section>
        <div className="mb-5">
          <p className="text-xs font-semibold uppercase tracking-[0.32em] text-[var(--accent)]">
            Weekly Chart
          </p>
          <h2 className="mt-2 text-2xl font-semibold tracking-tight text-white sm:text-4xl">
            Топ 10
          </h2>
        </div>

        <div className="cinema-mask hide-scrollbar -mx-4 flex gap-5 overflow-x-auto px-4 pb-9 pt-2 sm:-mx-6 sm:px-6 lg:-mx-8 lg:px-8">
          {movies.map((movie, index) => (
            <div key={`${movie.id}-${index}`} className="relative flex w-64 shrink-0 items-end">
              <span className="pointer-events-none absolute -left-2 bottom-8 z-0 text-[8rem] font-black leading-none tracking-[-0.08em] text-white/[0.07]">
                {index + 1}
              </span>
              <div className="relative z-10 ml-14 w-44">
                <MovieCard movie={movie} />
              </div>
            </div>
          ))}
        </div>
      </section>
    </Reveal>
  );
}
