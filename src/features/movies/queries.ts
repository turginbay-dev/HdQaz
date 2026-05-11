import { cache } from "react";
import { movies } from "./data";
import { getMovieBySlug as getMovieRecordBySlug, listMovies } from "./repository";
import { movieMatchesSearch } from "./search";
import type { Movie } from "@/types/movie";
import type { MovieRecord } from "@/types/backend";

export type MovieFilters = {
  genre?: string;
  catalog?: string;
  filter?: string;
  language?: string;
  q?: string;
};

const getPublishedMovies = cache(() => listMovies());
const getDraftAwareMovies = cache((includeDrafts: boolean) => listMovies({ includeDrafts }));

function matchesLegacyFilter(movie: Movie, filter?: string) {
  if (!filter) {
    return true;
  }

  if (filter === "new") {
    return movie.isNewRelease;
  }

  if (filter === "dubbed") {
    return movie.badges.includes("Қазақша дыбыстама");
  }

  if (filter === "subtitles") {
    return movie.badges.includes("Қазақша субтитрмен");
  }

  return true;
}

export async function getAllMovies(options: { includeDrafts?: boolean } = {}) {
  return options.includeDrafts ? getDraftAwareMovies(true) : getPublishedMovies();
}

export function selectMoviesByFilters(records: Movie[], filters: MovieFilters = {}) {
  const genre = filters.genre?.trim();
  const catalog = filters.catalog?.trim();
  const filter = filters.filter?.trim();
  const language = filters.language?.trim();
  const query = filters.q?.trim();

  return records.filter((movie) => {
    const matchesGenre = !genre || movie.genres.includes(genre);
    const matchesCatalog = !catalog || movie.catalogs.some((item) => item === catalog);
    const matchesLanguage = !language || movie.languages.some((item) => item === language);

    return matchesGenre && matchesCatalog && matchesLanguage && matchesLegacyFilter(movie, filter) && movieMatchesSearch(movie, query);
  });
}

export async function getMoviesByFilters(filters: MovieFilters = {}) {
  return selectMoviesByFilters(await getPublishedMovies(), filters);
}

export function getMoviesByCatalog(records: Movie[], catalog: string) {
  return selectMoviesByFilters(records, { catalog });
}

export function getMoviesByGenre(records: Movie[], genre: string) {
  return selectMoviesByFilters(records, { genre });
}

export function getFeaturedMovie(records: Movie[]) {
  return records[0] ?? movies[0];
}

export function getTrendingMovies(records: Movie[]) {
  return records;
}

export function getDubbedMovies(records: Movie[]) {
  return getMoviesByCatalog(records, "kazakh-dubbed");
}

export function getSubtitleMovies(records: Movie[]) {
  return getMoviesByCatalog(records, "kazakh-subtitles");
}

export function getNewReleases(records: Movie[]) {
  return getMoviesByCatalog(records, "new-releases");
}

export async function getMovieBySlug(slug: string): Promise<MovieRecord | null> {
  return getMovieRecordBySlug(slug);
}

export function getContinueWatchingMovies(records: Movie[]) {
  return records.slice(0, 3);
}

export function getAiRecommendedMovies(records: Movie[]) {
  const recommendations = getMoviesByCatalog(records, "ai-picks");
  const fallback = records.filter(
    (movie) => !recommendations.some((recommendedMovie) => recommendedMovie.id === movie.id)
  );

  return [...recommendations, ...fallback].slice(0, 3);
}

export function getTopTenMovies(records: Movie[]) {
  const ranked = getMoviesByCatalog(records, "top-10");
  const fallback = records.filter((movie) => !ranked.some((rankedMovie) => rankedMovie.id === movie.id));

  return [...ranked, ...fallback].slice(0, 10);
}
