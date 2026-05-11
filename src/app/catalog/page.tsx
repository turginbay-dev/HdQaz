import Link from "next/link";
import { Search, X } from "lucide-react";
import { LogoMark } from "@/components/layout/site-logo";
import { MovieCard } from "@/components/movie/movie-card";
import { getMoviesByFilters } from "@/features/movies/queries";
import { getCatalogLabel, getMovieLanguageLabel, movieCatalogs, movieGenres, movieLanguages } from "@/lib/movie-taxonomy";

export const metadata = {
  title: "Каталог"
};

type CatalogPageProps = {
  searchParams?: Promise<{
    catalog?: string | string[];
    filter?: string | string[];
    genre?: string | string[];
    language?: string | string[];
    q?: string | string[];
  }>;
};

const filterLabels: Record<string, string> = {
  new: "Жаңа релиздер",
  dubbed: "Қазақша дыбыстама",
  subtitles: "Қазақша субтитр"
};

function getSearchParam(value?: string | string[]) {
  return Array.isArray(value) ? value[0] : value;
}

function createCatalogHref(query: Record<string, string>) {
  return Object.keys(query).length > 0 ? { pathname: "/catalog", query } : "/catalog";
}

export default async function CatalogPage({ searchParams }: CatalogPageProps) {
  const params = await searchParams;
  const selectedCatalog = getSearchParam(params?.catalog);
  const selectedGenre = getSearchParam(params?.genre);
  const selectedFilter = getSearchParam(params?.filter);
  const selectedLanguage = getSearchParam(params?.language);
  const selectedQuery = getSearchParam(params?.q)?.trim();
  const movies = getMoviesByFilters({
    catalog: selectedCatalog,
    filter: selectedFilter,
    genre: selectedGenre,
    language: selectedLanguage,
    q: selectedQuery
  });
  const activeFilterQuery: Record<string, string> = {};

  if (selectedCatalog) activeFilterQuery.catalog = selectedCatalog;
  if (selectedGenre) activeFilterQuery.genre = selectedGenre;
  if (selectedFilter) activeFilterQuery.filter = selectedFilter;
  if (selectedLanguage) activeFilterQuery.language = selectedLanguage;

  const activeFilterLabel =
    selectedGenre ||
    (selectedLanguage ? getMovieLanguageLabel(selectedLanguage) : undefined) ||
    (selectedCatalog ? getCatalogLabel(selectedCatalog) : undefined) ||
    (selectedFilter ? filterLabels[selectedFilter] : undefined) ||
    "Барлық каталог";
  const selectedLabel =
    selectedQuery ? `«${selectedQuery}» іздеу нәтижесі` : activeFilterLabel;
  const clearSearchHref = createCatalogHref(activeFilterQuery);

  return (
    <main className="ambient-page min-h-screen pb-20 pt-28">
      <section className="mx-auto w-full max-w-7xl px-4 sm:px-6 lg:px-8">
        <div className="mb-8 grid gap-6 lg:grid-cols-[minmax(0,1fr)_380px] lg:items-end">
          <div className="max-w-3xl">
            <p className="inline-flex items-center gap-2 text-sm font-medium uppercase tracking-[0.28em] text-[var(--accent)]">
              <LogoMark className="h-8 w-8 p-0.5" sizes="32px" />
              HdQaz каталогы
            </p>
            <h1 className="mt-3 text-4xl font-semibold tracking-tight text-white sm:text-6xl">
              {selectedQuery ? "Іздеу нәтижелері" : "Киноны жанр және каталог бойынша табу"}
            </h1>
            <p className="mt-4 text-base leading-7 text-zinc-300">
              {selectedQuery
                ? `«${selectedQuery}» бойынша табылған фильмдер. Қажет болса жанр, тіл немесе каталогпен нақтылауға болады.`
                : "Дыбыстама, субтитр, тілдер, Premium, жаңа релиз және жанрлар бір жерде реттеледі."}
            </p>
          </div>

          <div className="glass rounded-[28px] p-5">
            <p className="text-xs uppercase tracking-[0.24em] text-zinc-500">Қазір ашық</p>
            <p className="mt-2 text-2xl font-semibold text-white">{selectedLabel}</p>
            <p className="mt-2 text-sm text-zinc-400">{movies.length} кино табылды</p>
          </div>
        </div>

        <form
          action="/catalog"
          className="glass mb-8 flex flex-col gap-3 rounded-[28px] p-3 sm:flex-row sm:items-center"
          method="get"
        >
          {selectedCatalog && <input name="catalog" type="hidden" value={selectedCatalog} />}
          {selectedGenre && <input name="genre" type="hidden" value={selectedGenre} />}
          {selectedFilter && <input name="filter" type="hidden" value={selectedFilter} />}
          {selectedLanguage && <input name="language" type="hidden" value={selectedLanguage} />}

          <label className="flex min-h-12 flex-1 items-center gap-3 rounded-2xl bg-black/20 px-4 text-white">
            <Search className="h-5 w-5 shrink-0 text-[var(--accent)]" />
            <input
              className="min-w-0 flex-1 bg-transparent text-base outline-none placeholder:text-zinc-500"
              defaultValue={selectedQuery ?? ""}
              name="q"
              placeholder="Кино, жанр, дыбыстама немесе жыл бойынша іздеу"
              type="search"
            />
          </label>

          <div className="flex gap-2">
            {selectedQuery && (
              <Link
                href={clearSearchHref}
                className="glass-button flex h-12 w-12 items-center justify-center rounded-2xl text-white"
                aria-label="Іздеуді тазалау"
              >
                <X className="h-5 w-5" />
              </Link>
            )}
            <button
              className="hero-watch-button flex h-12 flex-1 items-center justify-center gap-2 rounded-2xl px-5 text-sm font-semibold sm:flex-none"
              type="submit"
            >
              <Search className="h-4 w-4" />
              Іздеу
            </button>
          </div>
        </form>

        <div className="mb-8 space-y-4">
          <div>
            <p className="mb-3 text-xs font-semibold uppercase tracking-[0.28em] text-zinc-500">
              Каталогтар
            </p>
            <div className="hide-scrollbar cinema-mask -mx-4 flex gap-2 overflow-x-auto px-4 pb-2 sm:mx-0 sm:flex-wrap sm:px-0">
              <CatalogChip
                href="/catalog"
                label="Барлығы"
                active={!selectedCatalog && !selectedGenre && !selectedFilter && !selectedLanguage && !selectedQuery}
              />
              {movieCatalogs.map((catalog) => (
                <CatalogChip
                  key={catalog.id}
                  href={{ pathname: "/catalog", query: { catalog: catalog.id } }}
                  label={catalog.label}
                  active={selectedCatalog === catalog.id}
                />
              ))}
            </div>
          </div>

          <div>
            <p className="mb-3 text-xs font-semibold uppercase tracking-[0.28em] text-zinc-500">
              Тілдер
            </p>
            <div className="hide-scrollbar cinema-mask -mx-4 flex gap-2 overflow-x-auto px-4 pb-2 sm:mx-0 sm:flex-wrap sm:px-0">
              {movieLanguages.map((language) => (
                <CatalogChip
                  key={language.id}
                  href={{ pathname: "/catalog", query: { language: language.id } }}
                  label={language.label}
                  active={selectedLanguage === language.id}
                />
              ))}
            </div>
          </div>

          <div>
            <p className="mb-3 text-xs font-semibold uppercase tracking-[0.28em] text-zinc-500">
              Жанрлар
            </p>
            <div className="hide-scrollbar cinema-mask -mx-4 flex gap-2 overflow-x-auto px-4 pb-2 sm:mx-0 sm:flex-wrap sm:px-0">
              {movieGenres.map((genre) => (
                <CatalogChip
                  key={genre}
                  href={{ pathname: "/catalog", query: { genre } }}
                  label={genre}
                  active={selectedGenre === genre}
                />
              ))}
            </div>
          </div>
        </div>

        {movies.length > 0 ? (
          <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6">
            {movies.map((movie) => (
              <MovieCard key={movie.id} movie={movie} />
            ))}
          </div>
        ) : (
          <div className="glass-strong rounded-[34px] px-6 py-14 text-center">
            <p className="text-2xl font-semibold text-white">
              {selectedQuery ? `«${selectedQuery}» бойынша кино табылмады` : "Бұл бөлімге кино әлі қосылмаған"}
            </p>
            <p className="mx-auto mt-3 max-w-xl text-sm leading-6 text-zinc-400">
              {selectedQuery
                ? "Басқа атау, жанр, жыл немесе дыбыстама түрін енгізіп көріңіз."
                : "Админ панельден жанр мен каталогты белгілеген соң бұл жерде автоматты түрде шығады."}
            </p>
          </div>
        )}
      </section>
    </main>
  );
}

function CatalogChip({
  active,
  href,
  label
}: {
  active?: boolean;
  href: string | { pathname: string; query?: Record<string, string> };
  label: string;
}) {
  return (
    <Link
      href={href}
      className={
        active
          ? "shrink-0 rounded-full bg-white px-4 py-2.5 text-sm font-semibold text-black shadow-[0_14px_42px_rgba(255,255,255,0.16)]"
          : "glass-button shrink-0 rounded-full px-4 py-2.5 text-sm font-medium text-white"
      }
    >
      {label}
    </Link>
  );
}
