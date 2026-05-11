import Link from "next/link";
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

export default async function CatalogPage({ searchParams }: CatalogPageProps) {
  const params = await searchParams;
  const selectedCatalog = getSearchParam(params?.catalog);
  const selectedGenre = getSearchParam(params?.genre);
  const selectedFilter = getSearchParam(params?.filter);
  const selectedLanguage = getSearchParam(params?.language);
  const movies = getMoviesByFilters({
    catalog: selectedCatalog,
    filter: selectedFilter,
    genre: selectedGenre,
    language: selectedLanguage
  });
  const selectedLabel =
    selectedGenre ||
    (selectedLanguage ? getMovieLanguageLabel(selectedLanguage) : undefined) ||
    (selectedCatalog ? getCatalogLabel(selectedCatalog) : undefined) ||
    (selectedFilter ? filterLabels[selectedFilter] : undefined) ||
    "Барлық каталог";

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
              Киноны жанр және каталог бойынша табу
            </h1>
            <p className="mt-4 text-base leading-7 text-zinc-300">
              Дыбыстама, субтитр, тілдер, Premium, жаңа релиз және жанрлар бір жерде реттеледі.
            </p>
          </div>

          <div className="glass rounded-[28px] p-5">
            <p className="text-xs uppercase tracking-[0.24em] text-zinc-500">Қазір ашық</p>
            <p className="mt-2 text-2xl font-semibold text-white">{selectedLabel}</p>
            <p className="mt-2 text-sm text-zinc-400">{movies.length} кино табылды</p>
          </div>
        </div>

        <div className="mb-8 space-y-4">
          <div>
            <p className="mb-3 text-xs font-semibold uppercase tracking-[0.28em] text-zinc-500">
              Каталогтар
            </p>
            <div className="hide-scrollbar cinema-mask -mx-4 flex gap-2 overflow-x-auto px-4 pb-2 sm:mx-0 sm:flex-wrap sm:px-0">
              <CatalogChip
                href="/catalog"
                label="Барлығы"
                active={!selectedCatalog && !selectedGenre && !selectedFilter && !selectedLanguage}
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
            <p className="text-2xl font-semibold text-white">Бұл бөлімге кино әлі қосылмаған</p>
            <p className="mx-auto mt-3 max-w-xl text-sm leading-6 text-zinc-400">
              Админ панельден жанр мен каталогты белгілеген соң бұл жерде автоматты түрде шығады.
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
