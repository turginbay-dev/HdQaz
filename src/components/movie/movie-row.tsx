import Link from "next/link";
import { MovieCard } from "@/components/movie/movie-card";
import type { Movie } from "@/types/movie";
export function MovieRow({ href = "/catalog", title, movies, priorityCount = 0 }: { href?: string | { pathname: string; query?: Record<string, string> }; title: string; movies: Movie[]; priorityCount?: number }) {
  if (!movies.length) return null;
  return <section className="viewer-section">
    <div className="section-heading"><h2>{title}</h2><Link href={href}>Барлығы <span aria-hidden="true">↗</span></Link></div>
    <div className="movie-grid">{movies.map((movie, index) => <MovieCard key={movie.id} movie={movie} priority={index < priorityCount} />)}</div>
  </section>;
}
