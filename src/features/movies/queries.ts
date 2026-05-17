import { cache } from "react";
import { movies } from "./data";
import { movieMatchesSearch } from "./search";
import { contentToMovieRecord, getContentBySlug as getContentRecordBySlug, listContents } from "@/features/content/repository";
import type { Movie } from "@/types/movie";
import type { MovieRecord } from "@/types/backend";
import type { ContentType } from "@/types/content";

export type MovieFilters = {
  genre?: string;
  catalog?: string;
  filter?: string;
  language?: string;
  type?: ContentType | string;
  year?: string;
  country?: string;
  q?: string;
};

const getPublishedMovies = cache(() => listMovies());
const getDraftAwareMovies = cache((includeDrafts: boolean) => listMovies({ includeDrafts }));

async function listMovies(options: { includeDrafts?: boolean } = {}) {
  return (await listContents(options)).map(contentToMovieRecord);
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

export async function getAllMovies(options: { includeDrafts?: boolean } = {}) {
  return options.includeDrafts ? getDraftAwareMovies(true) : getPublishedMovies();
}

export function selectMoviesByFilters(records: Movie[], filters: MovieFilters = {}) {
  const genre = filters.genre?.trim();
  const catalog = filters.catalog?.trim();
  const filter = filters.filter?.trim();
  const language = filters.language?.trim();
  const type = filters.type?.trim();
  const year = filters.year?.trim();
  const country = filters.country?.trim();
  const query = filters.q?.trim();

  return records.filter((movie) => {
    const matchesGenre = !genre || movie.genres.includes(genre);
    const matchesCatalog = !catalog || movie.catalogs.some((item) => item === catalog);
    const matchesLanguage = !language || movie.languages.some((item) => item === language);
    const matchesType = !type || movie.type === type;
    const matchesYear = !year || String(movie.year) === year;
    const matchesCountry = !country || movie.country === country;

    return (
      matchesGenre &&
      matchesCatalog &&
      matchesLanguage &&
      matchesType &&
      matchesYear &&
      matchesCountry &&
      matchesLegacyFilter(movie, filter) &&
      movieMatchesSearch(movie, query)
    );
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

export function getHeroMovies(records: Movie[]) {
  const heroMovies = records
    .filter((movie) => movie.isHero)
    .sort((left, right) => (left.heroOrder ?? 9999) - (right.heroOrder ?? 9999));

  return heroMovies.length > 0 ? heroMovies : [getFeaturedMovie(records)];
}

export function getTrendingMovies(records: Movie[]) {
  return records;
}

export function getRelatedMovies(records: Movie[], current: Movie, limit = 10) {
  const currentGenres = new Set(current.genres);
  const currentCatalogs = new Set(current.catalogs);
  const currentLanguages = new Set(current.languages);

  const scoredMovies = records
    .filter((movie) => movie.id !== current.id)
    .map((movie, index) => {
      const genreMatches = movie.genres.filter((genre) => currentGenres.has(genre)).length;
      const catalogMatches = movie.catalogs.filter((catalog) => currentCatalogs.has(catalog)).length;
      const languageMatches = movie.languages.filter((language) => currentLanguages.has(language)).length;
      const sameType = movie.type && current.type && movie.type === current.type ? 1 : 0;
      const sameDubber = current.dubberId && movie.dubberId === current.dubberId ? 1 : 0;
      const score = sameType * 5 + genreMatches * 4 + catalogMatches * 2 + languageMatches + sameDubber * 2;

      return { index, movie, score };
    })
    .filter((item) => item.score > 0)
    .sort((a, b) => b.score - a.score || a.index - b.index)
    .map((item) => item.movie);

  const fallbackMovies = records.filter(
    (movie) => movie.id !== current.id && !scoredMovies.some((relatedMovie) => relatedMovie.id === movie.id)
  );

  return [...scoredMovies, ...fallbackMovies].slice(0, limit);
}

export function getDubbedMovies(records: Movie[]) {
  return getMoviesByCatalog(records, "kazakh-dubbed");
}

export function getSubtitleMovies(records: Movie[]) {
  return getMoviesByCatalog(records, "kazakh-subtitles");
}

export function getDoramaMovies(records: Movie[]) {
  return records.filter((movie) => movie.type === "dorama");
}

export function getAnimeMovies(records: Movie[]) {
  return records.filter((movie) => movie.type === "anime");
}

function isCartoonMovie(movie: Movie) {
  return (
    movie.type === "cartoon" ||
    (movie.type !== "anime" && movie.genres.some((genre) => genre === "Анимация" || genre === "Отбасы" || genre === "Мультфильм"))
  );
}

export function getFeatureMovies(records: Movie[]) {
  return records.filter((movie) => movie.type === "movie" && !isCartoonMovie(movie));
}

export function getCartoonMovies(records: Movie[]) {
  return records.filter(isCartoonMovie);
}

export function getNewReleases(records: Movie[]) {
  return getMoviesByCatalog(records, "new-releases");
}

export async function getMovieBySlug(slug: string): Promise<MovieRecord | null> {
  const content = await getContentRecordBySlug(slug);

  return content ? contentToMovieRecord(content) : null;
}

export function getTopTenMovies(records: Movie[]) {
  const ranked = getMoviesByCatalog(records, "top-10");
  const fallback = records.filter((movie) => !ranked.some((rankedMovie) => rankedMovie.id === movie.id));

  return [...ranked, ...fallback].slice(0, 10);
}
