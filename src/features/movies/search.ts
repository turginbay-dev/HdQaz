import { getCatalogLabel, getMovieLanguageLabel } from "@/lib/movie-taxonomy";
import { contentTypeLabels } from "@/features/content/format";
import type { Movie } from "@/types/movie";

export function normalizeSearchValue(value: string) {
  return value.normalize("NFKC").toLocaleLowerCase("kk-KZ").replace(/ё/g, "е").replace(/[^\p{L}\p{N}]+/gu, " ").trim().replace(/\s+/g, " ");
}

function getMovieSearchText(movie: Movie) {
  return [
    movie.title,
    movie.originalTitle,
    movie.description,
    movie.slug,
    movie.type ?? "",
    movie.type ? contentTypeLabels[movie.type] : "",
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

  const searchText = normalizeSearchValue(getMovieSearchText(movie));
  const terms = normalizedQuery.split(/\s+/).filter(Boolean);

  return terms.every((term) => searchText.includes(term)) || movieSearchRank(movie, normalizedQuery) < 7;
}

// Bounded edit distance, only used for title words and queries of meaningful length.
function closeWord(left: string, right: string) {
  const limit = left.length >= 7 ? 2 : 1;
  if (left.length < 4 || left.length > 80 || right.length > 80 || Math.abs(left.length - right.length) > limit) return false;
  let row = Array.from({ length: right.length + 1 }, (_, index) => index);
  for (let i = 1; i <= left.length; i++) {
    const next = [i];
    for (let j = 1; j <= right.length; j++) next[j] = Math.min(next[j - 1] + 1, row[j] + 1, row[j - 1] + (left[i - 1] === right[j - 1] ? 0 : 1));
    row = next;
  }
  return row[right.length] <= limit;
}

export function movieSearchRank(movie: Movie, query: string) {
  const q = normalizeSearchValue(query);
  const title = normalizeSearchValue(movie.title);
  const original = normalizeSearchValue(movie.originalTitle ?? "");
  if (!q) return 0;
  if (movie.title === query.trim()) return 0;
  if (title === q) return 1;
  if (title.startsWith(q)) return 2;
  if (title.split(" ").includes(q)) return 3;
  if (title.includes(q)) return 4;
  if (original.includes(q)) return 5;
  const words = `${title} ${original}`.split(" ");
  if (q.split(" ").every((term) => words.some((word) => word.includes(term) || closeWord(term, word)))) return 6;
  return 7;
}
