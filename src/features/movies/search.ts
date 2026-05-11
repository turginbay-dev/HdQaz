import { getCatalogLabel, getMovieLanguageLabel } from "@/lib/movie-taxonomy";
import type { Movie } from "@/types/movie";

function normalizeSearchValue(value: string) {
  return value.trim().toLocaleLowerCase("kk-KZ");
}

function getMovieSearchText(movie: Movie) {
  return [
    movie.title,
    movie.originalTitle,
    movie.description,
    movie.slug,
    String(movie.year),
    movie.runtime,
    movie.rating,
    ...movie.badges,
    ...movie.genres,
    ...movie.catalogs,
    ...movie.catalogs.map(getCatalogLabel),
    ...movie.languages,
    ...movie.languages.map((language) => getMovieLanguageLabel(language)),
    ...movie.languages.map((language) => getMovieLanguageLabel(language, "short"))
  ]
    .join(" ")
    .toLocaleLowerCase("kk-KZ");
}

export function movieMatchesSearch(movie: Movie, query?: string) {
  const normalizedQuery = query ? normalizeSearchValue(query) : "";

  if (!normalizedQuery) {
    return true;
  }

  const searchText = getMovieSearchText(movie);
  const terms = normalizedQuery.split(/\s+/).filter(Boolean);

  return terms.every((term) => searchText.includes(term));
}
