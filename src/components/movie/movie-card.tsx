import Link from "next/link";
import { MovieImage } from "@/components/movie/movie-image";
import { categoryLabel, displayTitles } from "@/lib/viewer-catalog";
import type { Movie } from "@/types/movie";
export function MovieCard({ eager = false, movie, priority = false }: { eager?: boolean; movie: Movie; priority?: boolean }) {
  const titles = displayTitles(movie);
  const translation = movie.catalogs.includes("kazakh-dubbed") ? "Қазақша дыбыстама" : movie.catalogs.includes("kazakh-subtitles") ? "Қазақша субтитр" : null;
  return <article className="viewer-movie-card">
    <Link prefetch={false} href={`/${movie.slug}`} title={movie.title}>
      <div className="viewer-poster">
        <MovieImage src={movie.posterUrl} alt={titles.title} fallback="poster" fill priority={priority} loading={priority ? undefined : eager ? "eager" : "lazy"} sizes="(max-width: 639px) 46vw, (max-width: 1023px) 23vw, 190px" className="object-cover" />
        {movie.isPremium && <span className="poster-label">Premium</span>}
      </div>
      <h3>{titles.title}</h3>
      <p className="card-original">{titles.original || "\u00a0"}</p>
      <p className="card-meta">{movie.year} · {categoryLabel(movie)}</p>
      <p className="card-translation">{translation || "\u00a0"}</p>
    </Link>
  </article>;
}
