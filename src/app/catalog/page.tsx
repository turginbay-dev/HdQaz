import type { Metadata } from "next";
import Link from "next/link";
import { ChevronDown, Search, SlidersHorizontal, Sparkles, X } from "lucide-react";
import { LogoMark } from "@/components/layout/site-logo";
import { MovieCard } from "@/components/movie/movie-card";
import { cn } from "@/lib/cn";
import {
  getCatalogLabel,
  getMovieLanguageLabel,
  movieCatalogs,
  movieGenres,
  movieLanguages
} from "@/lib/movie-taxonomy";
import { getCanonicalUrl } from "@/lib/site-url";
import { getAllMovies, selectMoviesByFilters } from "@/features/movies/queries";
import type { Movie } from "@/types/movie";
import type { ContentType } from "@/types/content";

export const metadata: Metadata = {
  title: "Кино әлемі",
  alternates: {
    canonical: getCanonicalUrl("/catalog")
  },
  openGraph: {
    url: getCanonicalUrl("/catalog")
  }
};

export const dynamic = "force-dynamic";

type CatalogPageProps = {
  searchParams?: Promise<{
    catalog?: string | string[];
    country?: string | string[];
    filter?: string | string[];
    genre?: string | string[];
    language?: string | string[];
    q?: string | string[];
    type?: string | string[];
    year?: string | string[];
  }>;
};

type CatalogQueryKey = "q" | "genre" | "catalog" | "filter" | "language" | "type" | "year" | "country";

type CatalogQueryState = Record<CatalogQueryKey, string | undefined>;

type FilterOption = {
  label: string;
  value: string;
};

const contentTypeOrder: ContentType[] = ["movie", "series", "anime", "dorama"];

const catalogContentTypeLabels: Record<ContentType, string> = {
  anime: "Аниме",
  dorama: "Дорама",
  movie: "Фильм",
  series: "Сериал"
};

const queryKeys: CatalogQueryKey[] = ["q", "genre", "catalog", "filter", "language", "type", "year", "country"];

function getSearchParam(value?: string | string[]) {
  const param = Array.isArray(value) ? value[0] : value;
  const normalized = param?.trim();

  return normalized || undefined;
}

function uniqueStrings(values: Array<string | null | undefined>) {
  return Array.from(
    new Set(
      values
        .map((value) => value?.trim())
        .filter((value): value is string => Boolean(value))
    )
  );
}

function sortByKazakhLabel(values: string[]) {
  return values.sort((a, b) => a.localeCompare(b, "kk-KZ"));
}

function getGenreOptions(movies: Movie[]) {
  const actualGenres = new Set(uniqueStrings(movies.flatMap((movie) => movie.genres)));
  const orderedKnownGenres = movieGenres.filter((genre) => actualGenres.has(genre));
  const customGenres = sortByKazakhLabel(
    Array.from(actualGenres).filter((genre) => !movieGenres.some((knownGenre) => knownGenre === genre))
  );

  return [...orderedKnownGenres, ...customGenres];
}

function getTypeOptions(movies: Movie[]): FilterOption[] {
  const actualTypes = new Set(uniqueStrings(movies.map((movie) => movie.type)));

  return contentTypeOrder
    .filter((type) => actualTypes.has(type))
    .map((type) => ({
      label: catalogContentTypeLabels[type],
      value: type
    }));
}

function getYearOptions(movies: Movie[]): FilterOption[] {
  return Array.from(new Set(movies.map((movie) => movie.year)))
    .sort((a, b) => b - a)
    .map((year) => ({
      label: String(year),
      value: String(year)
    }));
}

function getCountryOptions(movies: Movie[]): FilterOption[] {
  return sortByKazakhLabel(uniqueStrings(movies.map((movie) => movie.country))).map((country) => ({
    label: country,
    value: country
  }));
}

function getCatalogOptions(movies: Movie[]): FilterOption[] {
  const actualCatalogs = new Set(movies.flatMap((movie) => movie.catalogs));

  return movieCatalogs
    .filter((catalog) => actualCatalogs.has(catalog.id))
    .map((catalog) => ({
      label: getCatalogLabel(catalog.id),
      value: catalog.id
    }));
}

function getLanguageOptions(movies: Movie[]): FilterOption[] {
  const actualLanguages = new Set(movies.flatMap((movie) => movie.languages));

  return movieLanguages
    .filter((language) => actualLanguages.has(language.id))
    .map((language) => ({
      label: getMovieLanguageLabel(language.id, "short"),
      value: language.id
    }));
}

function buildCatalogHref(state: CatalogQueryState, updates: Partial<CatalogQueryState> = {}) {
  const nextState = { ...state, ...updates };
  const params = new URLSearchParams();

  for (const key of queryKeys) {
    const value = nextState[key];

    if (value) {
      params.set(key, value);
    }
  }

  const query = params.toString();

  return query ? `/catalog?${query}` : "/catalog";
}

function getActiveLabel(state: CatalogQueryState) {
  if (state.q) {
    return `«${state.q}» бойынша`;
  }

  if (state.genre) {
    return state.genre;
  }

  if (state.catalog) {
    return getCatalogLabel(state.catalog);
  }

  if (state.type && contentTypeOrder.includes(state.type as ContentType)) {
    return catalogContentTypeLabels[state.type as ContentType];
  }

  return "Барлық контент";
}

function CatalogSelect({
  label,
  name,
  options,
  value
}: {
  label: string;
  name: Exclude<CatalogQueryKey, "q" | "genre" | "filter">;
  options: FilterOption[];
  value?: string;
}) {
  if (options.length === 0 && !value) {
    return null;
  }

  return (
    <label className="min-w-0">
      <span className="mb-1.5 block text-[11px] font-bold uppercase tracking-[0.16em] text-zinc-500">
        {label}
      </span>
      <span className="relative block">
        <select
          className="h-11 w-full appearance-none rounded-2xl border border-white/10 bg-black/25 px-3.5 pr-9 text-sm font-bold tracking-[0.006em] text-white outline-none transition focus:border-[rgba(217,183,111,0.58)] focus:bg-black/40 focus:shadow-[0_0_0_3px_rgba(217,183,111,0.11)]"
          defaultValue={value ?? ""}
          name={name}
        >
          <option className="bg-zinc-950 text-white" value="">
            Барлығы
          </option>
          {options.map((option) => (
            <option className="bg-zinc-950 text-white" key={option.value} value={option.value}>
              {option.label}
            </option>
          ))}
        </select>
        <ChevronDown className="pointer-events-none absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[var(--accent)]" />
      </span>
    </label>
  );
}

export default async function CatalogPage({ searchParams }: CatalogPageProps) {
  const params = await searchParams;
  const selectedFilters: CatalogQueryState = {
    catalog: getSearchParam(params?.catalog),
    country: getSearchParam(params?.country),
    filter: getSearchParam(params?.filter),
    genre: getSearchParam(params?.genre),
    language: getSearchParam(params?.language),
    q: getSearchParam(params?.q),
    type: getSearchParam(params?.type),
    year: getSearchParam(params?.year)
  };

  const allMovies = await getAllMovies();
  const movies = selectMoviesByFilters(allMovies, selectedFilters);
  const genreOptions = getGenreOptions(allMovies);
  const typeOptions = getTypeOptions(allMovies);
  const yearOptions = getYearOptions(allMovies);
  const countryOptions = getCountryOptions(allMovies);
  const catalogOptions = getCatalogOptions(allMovies);
  const languageOptions = getLanguageOptions(allMovies);
  const activeFilterCount = Object.values(selectedFilters).filter(Boolean).length;
  const activeLabel = getActiveLabel(selectedFilters);
  const hasActiveFilters = activeFilterCount > 0;

  return (
    <main className="ambient-page min-h-screen pb-20 pt-24 sm:pt-28">
      <section className="mx-auto w-full max-w-7xl px-4 sm:px-6 lg:px-8">
        <form
          action="/catalog"
          className="mb-7 overflow-hidden rounded-[30px] border border-white/[0.13] bg-[linear-gradient(135deg,rgba(255,255,255,0.085),rgba(255,255,255,0.035)_48%,rgba(217,183,111,0.07))] p-4 shadow-[inset_0_1px_0_rgba(255,255,255,0.08),0_28px_110px_rgba(0,0,0,0.5)] backdrop-blur-[28px] sm:p-5 lg:p-6"
          method="get"
        >
          {selectedFilters.genre && <input name="genre" type="hidden" value={selectedFilters.genre} />}
          {selectedFilters.filter && <input name="filter" type="hidden" value={selectedFilters.filter} />}

          <div className="grid gap-5 lg:grid-cols-[minmax(0,0.82fr)_minmax(420px,1fr)] lg:items-end">
            <div className="min-w-0">
              <p className="inline-flex items-center gap-2 text-xs font-bold uppercase tracking-[0.18em] text-[var(--accent)]">
                <LogoMark className="h-7 w-10 p-0.5" sizes="40px" />
                HdQaz таңдауы
              </p>
              <div className="mt-3 flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between lg:block">
                <div>
                  <h1 className="type-cinematic premium-gradient-text text-3xl sm:text-4xl lg:text-[2.65rem]">
                    Кино әлемі
                  </h1>
                  <p className="mt-2 max-w-2xl text-sm font-medium leading-6 tracking-[0.004em] text-zinc-300 sm:text-base">
                    Қалаған фильміңізді тез табыңыз
                  </p>
                </div>
                <div className="flex flex-wrap gap-2 lg:mt-4">
                  <span className="inline-flex h-9 items-center rounded-full border border-white/10 bg-black/20 px-3 text-xs font-bold tracking-[0.01em] text-zinc-200">
                    {movies.length} нәтиже
                  </span>
                  <span className="inline-flex h-9 max-w-full items-center rounded-full border border-[rgba(217,183,111,0.22)] bg-[rgba(217,183,111,0.1)] px-3 text-xs font-bold tracking-[0.01em] text-[var(--accent)]">
                    <span className="truncate">{activeLabel}</span>
                  </span>
                </div>
              </div>
            </div>

            <div className="min-w-0">
              <label className="mb-2 block text-[11px] font-bold uppercase tracking-[0.16em] text-zinc-500" htmlFor="catalog-search">
                Іздеу
              </label>
              <div className="grid gap-2 sm:grid-cols-[minmax(0,1fr)_auto]">
                <div className="flex h-14 min-w-0 items-center gap-3 rounded-2xl border border-white/10 bg-black/25 px-4 text-white transition focus-within:border-[rgba(217,183,111,0.6)] focus-within:bg-black/35 focus-within:shadow-[0_0_0_3px_rgba(217,183,111,0.11),0_0_38px_rgba(217,183,111,0.12)]">
                  <Search className="h-5 w-5 shrink-0 text-[var(--accent)]" />
                  <input
                    className="min-w-0 flex-1 bg-transparent text-base font-semibold tracking-[0.004em] outline-none placeholder:text-zinc-500"
                    defaultValue={selectedFilters.q ?? ""}
                    id="catalog-search"
                    name="q"
                    placeholder="Фильм, аниме немесе дорама іздеу..."
                    type="search"
                  />
                  {selectedFilters.q && (
                    <Link
                      aria-label="Іздеуді тазалау"
                      className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full border border-white/10 bg-white/[0.07] text-zinc-300 transition hover:border-white/20 hover:bg-white/[0.12] hover:text-white"
                      href={buildCatalogHref(selectedFilters, { q: undefined })}
                    >
                      <X className="h-4 w-4" />
                    </Link>
                  )}
                </div>
                <button
                  className="hero-watch-button inline-flex h-14 items-center justify-center gap-2 rounded-2xl px-5 text-sm font-bold tracking-[0.014em]"
                  type="submit"
                >
                  <Search className="h-4 w-4" />
                  Табу
                </button>
              </div>
            </div>
          </div>

          <div className="mt-5 grid gap-4 lg:grid-cols-[minmax(0,1fr)_minmax(290px,0.42fr)]">
            <div className="min-w-0">
              <div className="mb-2 flex items-center justify-between gap-3">
                <p className="text-[11px] font-bold uppercase tracking-[0.16em] text-zinc-500">Жанрлар</p>
                <p className="hidden text-xs font-semibold tracking-[0.004em] text-zinc-500 sm:block">
                  {genreOptions.length} бағыт
                </p>
              </div>
              <div className="grid grid-cols-2 gap-2 sm:grid-cols-[repeat(auto-fit,minmax(132px,1fr))] lg:grid-cols-[repeat(5,minmax(0,1fr))] xl:grid-cols-[repeat(6,minmax(0,1fr))]">
                <Link
                  aria-current={!selectedFilters.genre ? "page" : undefined}
                  className={cn(
                    "inline-flex min-h-10 items-center justify-center rounded-2xl border px-3 text-center text-sm font-bold tracking-[0.006em] transition",
                    !selectedFilters.genre
                      ? "border-[rgba(217,183,111,0.46)] bg-[rgba(217,183,111,0.18)] text-white shadow-[0_0_34px_rgba(217,183,111,0.14)]"
                      : "border-white/10 bg-white/[0.055] text-zinc-300 hover:border-white/20 hover:bg-white/[0.1] hover:text-white"
                  )}
                  href={buildCatalogHref(selectedFilters, { genre: undefined })}
                >
                  Барлығы
                </Link>
                {genreOptions.map((genre) => {
                  const active = selectedFilters.genre === genre;

                  return (
                    <Link
                      aria-current={active ? "page" : undefined}
                      className={cn(
                        "inline-flex min-h-10 items-center justify-center rounded-2xl border px-3 text-center text-sm font-bold tracking-[0.006em] transition",
                        active
                          ? "border-[rgba(217,183,111,0.5)] bg-[linear-gradient(135deg,rgba(217,183,111,0.28),rgba(255,180,92,0.16))] text-white shadow-[0_0_36px_rgba(217,183,111,0.16)]"
                          : "border-white/10 bg-white/[0.055] text-zinc-300 hover:border-white/20 hover:bg-white/[0.1] hover:text-white"
                      )}
                      href={buildCatalogHref(selectedFilters, { genre: active ? undefined : genre })}
                      key={genre}
                    >
                      <span className="truncate">{genre}</span>
                    </Link>
                  );
                })}
              </div>
            </div>

            <div className="min-w-0">
              <div className="mb-2 flex items-center gap-2 text-[11px] font-bold uppercase tracking-[0.16em] text-zinc-500">
                <SlidersHorizontal className="h-3.5 w-3.5 text-[var(--accent)]" />
                Сүзгілер
              </div>
              <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-1 xl:grid-cols-2">
                <CatalogSelect label="Санаты" name="type" options={typeOptions} value={selectedFilters.type} />
                <CatalogSelect label="Жылы" name="year" options={yearOptions} value={selectedFilters.year} />
                <CatalogSelect label="Елі" name="country" options={countryOptions} value={selectedFilters.country} />
                <CatalogSelect label="Топтама" name="catalog" options={catalogOptions} value={selectedFilters.catalog} />
                {(languageOptions.length > 1 || selectedFilters.language) && (
                  <CatalogSelect
                    label="Тілі"
                    name="language"
                    options={languageOptions}
                    value={selectedFilters.language}
                  />
                )}
              </div>
              <div className="mt-3 flex flex-wrap items-center gap-2">
                <button
                  className="glass-button inline-flex h-11 flex-1 items-center justify-center gap-2 rounded-2xl px-4 text-sm font-bold text-white sm:flex-none lg:flex-1"
                  type="submit"
                >
                  <Sparkles className="h-4 w-4 text-[var(--accent)]" />
                  Қолдану
                </button>
                {hasActiveFilters && (
                  <Link
                    className="inline-flex h-11 flex-1 items-center justify-center gap-2 rounded-2xl border border-white/10 bg-white/[0.055] px-4 text-sm font-bold text-zinc-200 transition hover:border-white/20 hover:bg-white/[0.1] hover:text-white sm:flex-none lg:flex-1"
                    href="/catalog"
                  >
                    <X className="h-4 w-4" />
                    Тазарту
                  </Link>
                )}
              </div>
              {hasActiveFilters && (
                <p className="mt-2 text-xs font-semibold tracking-[0.004em] text-zinc-500">
                  {activeFilterCount} белсенді сүзгі бірге қолданылып тұр
                </p>
              )}
            </div>
          </div>
        </form>

        {movies.length > 0 ? (
          <div className="grid grid-cols-2 gap-x-4 gap-y-8 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6">
            {movies.map((movie) => (
              <MovieCard key={movie.id} movie={movie} />
            ))}
          </div>
        ) : (
          <div className="glass-strong rounded-[30px] px-6 py-14 text-center">
            <p className="text-2xl font-semibold text-white">
              {selectedFilters.q ? `«${selectedFilters.q}» бойынша контент табылмады` : "Бұл таңдауда контент табылмады"}
            </p>
            <p className="mx-auto mt-3 max-w-xl text-sm leading-6 text-zinc-400">
              Басқа атау енгізіп көріңіз немесе белсенді сүзгілерді тазалаңыз.
            </p>
            {hasActiveFilters && (
              <Link
                className="hero-watch-button mt-6 inline-flex h-12 items-center justify-center gap-2 rounded-2xl px-5 text-sm font-bold"
                href="/catalog"
              >
                <X className="h-4 w-4" />
                Сүзгіні тазалау
              </Link>
            )}
          </div>
        )}
      </section>
    </main>
  );
}
