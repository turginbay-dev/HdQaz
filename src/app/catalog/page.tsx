import type { Metadata } from "next";
import Link from "next/link";
import { ChevronDown, Search, SlidersHorizontal, X } from "lucide-react";
import { MovieCard } from "@/components/movie/movie-card";
import { selectViewerCategory, viewerCategories } from "@/lib/viewer-catalog";
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

const contentTypeOrder: ContentType[] = ["movie", "cartoon", "dorama", "anime", "series"];

const catalogContentTypeLabels: Record<ContentType, string> = {
  anime: "Аниме",
  cartoon: "Мультфильм",
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
  const movies = selectMoviesByFilters(selectViewerCategory(allMovies, selectedFilters.type), selectedFilters);
  const genreOptions = getGenreOptions(allMovies);
  const typeOptions = getTypeOptions(allMovies);
  const yearOptions = getYearOptions(allMovies);
  const countryOptions = getCountryOptions(allMovies);
  const catalogOptions = getCatalogOptions(allMovies);
  const languageOptions = getLanguageOptions(allMovies);
  const activeFilterCount = Object.values(selectedFilters).filter(Boolean).length;
  const activeLabel = getActiveLabel(selectedFilters);
  const hasActiveFilters = activeFilterCount > 0;

  return <main className="viewer-container catalog-page" id="main-content">
    <h1>Каталог</h1>
    <form action="/catalog" method="get" key={JSON.stringify(selectedFilters)} className="catalog-form">
      <div className="catalog-search-row">
        <label className="sr-only" htmlFor="catalog-search">Кино іздеу</label>
        <input defaultValue={selectedFilters.q ?? ""} id="catalog-search" name="q" placeholder="Фильм, аниме немесе дорама іздеу…" type="search" />
        <button type="submit" className="primary-button"><Search size={18} /><span>Табу</span></button>
      </div>
      <nav className="category-navigation" aria-label="Каталог санаттары">
        <Link aria-current={!selectedFilters.type ? "page" : undefined} href={buildCatalogHref(selectedFilters, { type: undefined })}>Барлығы</Link>
        {viewerCategories.filter(category => typeOptions.some(option => option.value === category.type)).map(category => <Link key={category.type} aria-current={selectedFilters.type === category.type ? "page" : undefined} href={buildCatalogHref(selectedFilters, { type: category.type })}>{category.label}</Link>)}
      </nav>
      <div className="catalog-result-summary"><p><strong>{movies.length}</strong> нәтиже · {activeLabel}</p>{hasActiveFilters && <Link href="/catalog" className="clear-filters">Тазарту <X size={16} /></Link>}</div>
      {hasActiveFilters && <div className="active-filters" aria-label="Белсенді сүзгілер">{queryKeys.filter(key => selectedFilters[key]).map(key => <Link key={key} href={buildCatalogHref(selectedFilters, { [key]: undefined })}>{key === "catalog" ? getCatalogLabel(selectedFilters[key]!) : key === "type" ? viewerCategories.find(category => category.type === selectedFilters.type)?.label ?? selectedFilters[key] : selectedFilters[key]}<X size={14} /><span className="sr-only"> — алып тастау</span></Link>)}</div>}
      <details className="catalog-filters">
        <summary><SlidersHorizontal size={18} /> Сүзгілер{activeFilterCount ? ` (${activeFilterCount})` : ""}<ChevronDown size={16} /></summary>
        <div className="filter-grid">
          <input type="hidden" name="type" value={selectedFilters.type ?? ""} />
          {selectedFilters.filter && <input type="hidden" name="filter" value={selectedFilters.filter} />}
          <label><span className="filter-label">Жанр</span><select name="genre" defaultValue={selectedFilters.genre ?? ""}><option value="">Барлығы</option>{genreOptions.map(genre => <option key={genre}>{genre}</option>)}</select></label>
          <CatalogSelect label="Жылы" name="year" options={yearOptions} value={selectedFilters.year} />
          <CatalogSelect label="Елі" name="country" options={countryOptions} value={selectedFilters.country} />
          <CatalogSelect label="Аударма / топтама" name="catalog" options={catalogOptions} value={selectedFilters.catalog} />
          <CatalogSelect label="Тілі" name="language" options={languageOptions} value={selectedFilters.language} />
        </div>
        <button className="secondary-button" type="submit">Қолдану</button>
      </details>
    </form>
    {movies.length ? <div className="movie-grid">{movies.map((movie, index) => <MovieCard key={movie.id} movie={movie} priority={index < 2} />)}</div> : <div className="empty-state"><h2>{selectedFilters.q ? `«${selectedFilters.q}» бойынша контент табылмады` : "Бұл таңдауда контент табылмады"}</h2><p>Басқа атау енгізіңіз немесе сүзгілерді тазалаңыз.</p>{hasActiveFilters && <Link className="secondary-button" href="/catalog">Сүзгілерді тазарту</Link>}</div>}
  </main>;
}
