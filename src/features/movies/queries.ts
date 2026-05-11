import { movies } from "./data";
import type { Movie } from "@/types/movie";

export type MovieFilters = {
  genre?: string;
  catalog?: string;
  filter?: string;
  language?: string;
};

export function getAllMovies() {
  return movies;
}

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

export function getMoviesByFilters(filters: MovieFilters = {}) {
  const genre = filters.genre?.trim();
  const catalog = filters.catalog?.trim();
  const filter = filters.filter?.trim();
  const language = filters.language?.trim();

  return movies.filter((movie) => {
    const matchesGenre = !genre || movie.genres.includes(genre);
    const matchesCatalog = !catalog || movie.catalogs.some((item) => item === catalog);
    const matchesLanguage = !language || movie.languages.some((item) => item === language);

    return matchesGenre && matchesCatalog && matchesLanguage && matchesLegacyFilter(movie, filter);
  });
}

export function getMoviesByCatalog(catalog: string) {
  return getMoviesByFilters({ catalog });
}

export function getMoviesByGenre(genre: string) {
  return getMoviesByFilters({ genre });
}

export function getFeaturedMovie() {
  return movies[1];
}

export function getTrendingMovies() {
  return movies;
}

export function getDubbedMovies() {
  return getMoviesByCatalog("kazakh-dubbed");
}

export function getSubtitleMovies() {
  return getMoviesByCatalog("kazakh-subtitles");
}

export function getNewReleases() {
  return getMoviesByCatalog("new-releases");
}

export function getMovieBySlug(slug: string) {
  return movies.find((movie) => movie.slug === slug);
}

export function getContinueWatchingMovies() {
  return movies.slice(0, 3);
}

export function getAiRecommendedMovies() {
  const recommendations = getMoviesByCatalog("ai-picks");
  const fallback = [movies[1], movies[3], movies[4]].filter(
    (movie) => !recommendations.some((recommendedMovie) => recommendedMovie.id === movie.id)
  );

  return [...recommendations, ...fallback].slice(0, 3);
}

export function getTopTenMovies() {
  const ranked = getMoviesByCatalog("top-10");
  const fallback = movies.filter((movie) => !ranked.some((rankedMovie) => rankedMovie.id === movie.id));

  return [...ranked, ...fallback].slice(0, 10);
}
