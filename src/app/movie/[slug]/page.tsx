import Link from "next/link";
import { notFound } from "next/navigation";
import { Play, Plus } from "lucide-react";
import { GlassPanel } from "@/components/glass/glass-panel";
import { MovieImage } from "@/components/movie/movie-image";
import { MovieBadge } from "@/components/movie/movie-badge";
import { MovieRow } from "@/components/movie/movie-row";
import { getAllMovies, getMovieBySlug, getTrendingMovies } from "@/features/movies/queries";
import { getCatalogLabel, getMovieLanguageLabel } from "@/lib/movie-taxonomy";

export const dynamic = "force-dynamic";

type MoviePageProps = {
  params: Promise<{
    slug: string;
  }>;
};

export default async function MoviePage({ params }: MoviePageProps) {
  const { slug } = await params;
  const [movie, movies] = await Promise.all([getMovieBySlug(slug), getAllMovies()]);

  if (!movie) {
    notFound();
  }

  return (
    <main className="min-h-screen pb-20">
      <section className="relative min-h-[78vh] overflow-hidden">
        <MovieImage
          src={movie.backdropUrl}
          alt=""
          fallback="backdrop"
          fill
          priority
          sizes="100vw"
          className="absolute inset-0 h-full w-full object-cover"
        />
        <div className="absolute inset-0 bg-gradient-to-r from-black via-black/70 to-black/20" />
        <div className="absolute inset-0 bg-gradient-to-t from-[var(--background)] via-transparent to-black/40" />

        <div className="relative mx-auto flex min-h-[78vh] w-full max-w-7xl items-end px-4 pb-14 pt-32 sm:px-6 lg:px-8">
          <div className="grid w-full gap-8 lg:grid-cols-[minmax(0,1fr)_340px] lg:items-end">
            <div className="max-w-3xl">
              <div className="mb-4 flex flex-wrap gap-2">
                {movie.badges.map((badge) => (
                  <MovieBadge key={badge} label={badge} />
                ))}
                {movie.languages.map((language) => (
                  <span
                    key={language}
                    className="rounded-full border border-white/15 bg-white/10 px-3 py-1 text-xs font-semibold text-zinc-100"
                  >
                    {getMovieLanguageLabel(language)}
                  </span>
                ))}
              </div>
              <h1 className="text-5xl font-semibold tracking-tight text-white sm:text-7xl">
                {movie.title}
              </h1>
              <p className="mt-4 max-w-2xl text-base leading-7 text-zinc-200 sm:text-lg">
                {movie.description}
              </p>
              <div className="mt-5 flex flex-wrap gap-2">
                {movie.genres.map((genre) => (
                  <Link
                    key={genre}
                    href={{ pathname: "/catalog", query: { genre } }}
                    className="glass-button rounded-full px-3 py-1.5 text-xs font-semibold text-white"
                  >
                    {genre}
                  </Link>
                ))}
                {movie.catalogs.map((catalog) => (
                  <Link
                    key={catalog}
                    href={{ pathname: "/catalog", query: { catalog } }}
                    className="rounded-full border border-[rgba(217,183,111,0.28)] bg-[rgba(217,183,111,0.12)] px-3 py-1.5 text-xs font-semibold text-[var(--accent)]"
                  >
                    {getCatalogLabel(catalog)}
                  </Link>
                ))}
              </div>
              <div className="mt-8 flex flex-wrap gap-3">
                <Link
                  href={`/watch/${movie.slug}`}
                  className="inline-flex items-center gap-2 rounded-full bg-white px-5 py-3 text-sm font-semibold text-black transition hover:bg-zinc-200"
                >
                  <Play className="h-4 w-4 fill-current" />
                  Көру
                </Link>
                <button className="glass-button inline-flex items-center gap-2 rounded-full px-5 py-3 text-sm font-semibold text-white">
                  <Plus className="h-4 w-4" />
                  Тізімге қосу
                </button>
              </div>
            </div>

            <GlassPanel className="hidden p-4 lg:block">
              <MovieImage
                src={movie.posterUrl}
                alt={movie.title}
                fallback="poster"
                width={680}
                height={1020}
                className="aspect-[2/3] w-full rounded-md object-cover"
              />
            </GlassPanel>
          </div>
        </div>
      </section>

      <div className="mx-auto w-full max-w-7xl px-4 sm:px-6 lg:px-8">
        <MovieRow title="Ұқсас кинолар" movies={getTrendingMovies(movies)} />
      </div>
    </main>
  );
}
