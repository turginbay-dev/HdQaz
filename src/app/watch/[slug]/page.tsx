import { notFound } from "next/navigation";
import { HlsPlayer } from "@/components/player/hls-player";
import { GlassPanel } from "@/components/glass/glass-panel";
import { MovieBadge } from "@/components/movie/movie-badge";
import { getMovieBySlug } from "@/features/movies/queries";
import { getMovieLanguageLabel } from "@/lib/movie-taxonomy";

type WatchPageProps = {
  params: Promise<{
    slug: string;
  }>;
};

export default async function WatchPage({ params }: WatchPageProps) {
  const { slug } = await params;
  const movie = getMovieBySlug(slug);

  if (!movie) {
    notFound();
  }

  return (
    <main className="min-h-screen px-4 pb-20 pt-24 sm:px-6 lg:px-8">
      <div className="mx-auto w-full max-w-7xl">
        <HlsPlayer poster={movie.backdropUrl} src={movie.streams.master} languages={movie.languages} />

        <GlassPanel className="mt-5 p-4 sm:p-5">
          <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
            <div>
              <div className="mb-2 flex flex-wrap gap-2">
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
              <h1 className="text-2xl font-semibold text-white">{movie.title}</h1>
              <p className="mt-2 max-w-3xl text-sm leading-6 text-zinc-300">
                {movie.description}
              </p>
            </div>

            <div className="flex flex-wrap gap-2">
              {["Болашақта көремін", "Көрдім", "Ұнады", "Telegram"].map((item) => (
                <button
                  key={item}
                  className="glass-button rounded-full px-4 py-2 text-sm font-medium text-white"
                >
                  {item}
                </button>
              ))}
            </div>
          </div>
        </GlassPanel>
      </div>
    </main>
  );
}
