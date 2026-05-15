import Link from "next/link";
import { Search, X } from "lucide-react";
import { LogoMark } from "@/components/layout/site-logo";
import { MovieCard } from "@/components/movie/movie-card";
import { getMoviesByFilters } from "@/features/movies/queries";

export const metadata = {
  title: "Каталог"
};

export const dynamic = "force-dynamic";

type CatalogPageProps = {
  searchParams?: Promise<{
    q?: string | string[];
  }>;
};

function getSearchParam(value?: string | string[]) {
  return Array.isArray(value) ? value[0] : value;
}

export default async function CatalogPage({ searchParams }: CatalogPageProps) {
  const params = await searchParams;
  const selectedQuery = getSearchParam(params?.q)?.trim();
  const movies = await getMoviesByFilters({
    q: selectedQuery
  });
  const selectedLabel = selectedQuery ? `«${selectedQuery}» іздеу нәтижесі` : "Барлық контент";

  return (
    <main className="ambient-page min-h-screen pb-20 pt-28">
      <section className="mx-auto w-full max-w-7xl px-4 sm:px-6 lg:px-8">
        <div className="mb-8 grid gap-6 lg:grid-cols-[minmax(0,1fr)_380px] lg:items-end">
          <div className="max-w-3xl">
            <p className="inline-flex items-center gap-2 text-sm font-bold uppercase tracking-[0.22em] text-[var(--accent)]">
              <LogoMark className="h-8 w-12 p-0.5" sizes="48px" />
              HdQaz каталогы
            </p>
            <h1 className="mt-3 text-4xl font-bold tracking-[-0.026em] text-white sm:text-6xl">
              {selectedQuery ? "Іздеу нәтижелері" : "Барлық контент"}
            </h1>
            <p className="mt-4 text-base font-medium leading-7 tracking-[0.004em] text-zinc-300">
              {selectedQuery
                ? `«${selectedQuery}» бойынша табылған контент.`
                : "Фильм, дорама, аниме және сериалдар бір таза тізімде көрсетіледі."}
            </p>
          </div>

          <div className="glass rounded-[28px] p-5">
            <p className="text-xs font-semibold uppercase tracking-[0.2em] text-zinc-500">Қазір ашық</p>
            <p className="mt-2 text-2xl font-bold tracking-[-0.018em] text-white">{selectedLabel}</p>
            <p className="mt-2 text-sm font-medium tracking-[0.004em] text-zinc-400">{movies.length} контент табылды</p>
          </div>
        </div>

        <form
          action="/catalog"
          className="glass mb-8 flex flex-col gap-3 rounded-[28px] p-3 sm:flex-row sm:items-center"
          method="get"
        >
          <label className="flex min-h-12 flex-1 items-center gap-3 rounded-2xl bg-black/20 px-4 text-white">
            <Search className="h-5 w-5 shrink-0 text-[var(--accent)]" />
            <input
              className="min-w-0 flex-1 bg-transparent text-base font-medium tracking-[0.004em] outline-none placeholder:text-zinc-500"
              defaultValue={selectedQuery ?? ""}
              name="q"
              placeholder="Атауы, елі, дыбыстаушысы немесе жылы бойынша іздеу"
              type="search"
            />
          </label>

          <div className="flex gap-2">
            {selectedQuery && (
              <Link
                href="/catalog"
                className="glass-button flex h-12 w-12 items-center justify-center rounded-2xl text-white"
                aria-label="Іздеуді тазалау"
              >
                <X className="h-5 w-5" />
              </Link>
            )}
            <button
              className="hero-watch-button flex h-12 flex-1 items-center justify-center gap-2 rounded-2xl px-5 text-sm font-bold tracking-[0.014em] sm:flex-none"
              type="submit"
            >
              <Search className="h-4 w-4" />
              Іздеу
            </button>
          </div>
        </form>

        {movies.length > 0 ? (
          <div className="grid grid-cols-2 gap-x-4 gap-y-8 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6">
            {movies.map((movie) => (
              <MovieCard key={movie.id} movie={movie} />
            ))}
          </div>
        ) : (
          <div className="glass-strong rounded-[34px] px-6 py-14 text-center">
            <p className="text-2xl font-semibold text-white">
              {selectedQuery ? `«${selectedQuery}» бойынша контент табылмады` : "Бұл бөлімге контент әлі қосылмаған"}
            </p>
            <p className="mx-auto mt-3 max-w-xl text-sm leading-6 text-zinc-400">
              {selectedQuery
                ? "Басқа атау, ел, жыл немесе дыбыстаушы атауын енгізіп көріңіз."
                : "Админ панельден жарияланған контент бұл жерде автоматты түрде шығады."}
            </p>
          </div>
        )}
      </section>
    </main>
  );
}
