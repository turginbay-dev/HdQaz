import type { Movie } from "@/types/movie";
import type { ContentType } from "@/types/content";
import { contentTypeLabels } from "@/features/content/format";

// Movie.type is the existing public category mapped by contentToMovieRecord.
// Release format, genres and translation catalogs are independent dimensions.
export const viewerCategories: { type: ContentType; label: string }[] = [
  { type: "movie", label: "Фильмдер" },
  { type: "dorama", label: "Дорамалар" },
  { type: "anime", label: "Аниме" },
  { type: "cartoon", label: "Мультфильмдер" },
  { type: "series", label: "Сериалдар" }
];
export function categoryLabel(movie: Pick<Movie, "type">) {
  return movie.type ? contentTypeLabels[movie.type] : "Санаты көрсетілмеген";
}
export function selectViewerCategory(movies: Movie[], type?: string) {
  const seen = new Set<string>();
  return movies.filter(movie => {
    if ((type && movie.type !== type) || seen.has(movie.id)) return false;
    seen.add(movie.id);
    return true;
  });
}
export function displayTitles(movie: Pick<Movie, "title" | "originalTitle">) {
  const [title, ...translations] = movie.title.split(" / ");
  return { title, original: movie.originalTitle && movie.originalTitle !== movie.title && movie.originalTitle !== title
    ? movie.originalTitle : translations.join(" / ") };
}
export function selectViewerRelated(movies: Movie[], current: Movie, limit = 6) {
  return selectViewerCategory(movies).filter(movie => movie.id !== current.id && movie.type === current.type &&
    movie.genres.some(genre => current.genres.includes(genre))).slice(0, limit);
}
