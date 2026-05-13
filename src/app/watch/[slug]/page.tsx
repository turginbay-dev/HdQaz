import { notFound, redirect } from "next/navigation";
import { HlsPlayer } from "@/components/player/hls-player";
import { GlassPanel } from "@/components/glass/glass-panel";
import { MovieBadge } from "@/components/movie/movie-badge";
import { RelatedMoviesPanel } from "@/components/movie/related-movies-panel";
import { contentStatusLabels, contentTypeLabels, isEpisodicContent } from "@/features/content/format";
import { getAllMovies, getMovieBySlug, getRelatedMovies } from "@/features/movies/queries";
import { getMovieImageSrc } from "@/lib/movie-images";

export const dynamic = "force-dynamic";

type WatchPageProps = {
  params: Promise<{
    slug: string;
  }>;
};

export default async function WatchPage({ params }: WatchPageProps) {
  const { slug } = await params;
  const [content, movies] = await Promise.all([getMovieBySlug(slug), getAllMovies()]);

  if (!content) {
    notFound();
  }

  if (isEpisodicContent(content)) {
    const firstEpisode = content.episodes?.[0];

    if (!firstEpisode) {
      notFound();
    }

    redirect(`/watch/${content.slug}/${firstEpisode.slug}`);
  }

  const streamUrl = content.hlsUrl ?? content.streams.master;

  if (!streamUrl) {
    notFound();
  }

  const typeLabel = content.type ? contentTypeLabels[content.type] : "Movie";
  const statusLabel = content.status ? contentStatusLabels[content.status] : "Аяқталған";
  const relatedMovies = getRelatedMovies(movies, content, 6);
  const skipIntro =
    typeof content.introStartSeconds === "number" &&
    typeof content.introEndSeconds === "number" &&
    content.introEndSeconds > content.introStartSeconds
      ? {
          startSeconds: content.introStartSeconds,
          endSeconds: content.introEndSeconds,
          label: "Интроны өткізу"
        }
      : null;

  return (
    <main className="min-h-screen px-4 pb-20 pt-24 sm:px-6 lg:px-8">
      <div className="mx-auto w-full max-w-7xl">
        <div
          className={
            relatedMovies.length > 0
              ? "grid gap-5 xl:grid-cols-[minmax(0,1fr)_340px] xl:items-start"
              : "grid gap-5"
          }
        >
          <div className="min-w-0">
            <HlsPlayer
              poster={getMovieImageSrc(content.backdropUrl, "backdrop")}
              src={streamUrl}
              languages={content.languages}
              progressKey={`movie:${content.slug}`}
              skipIntro={skipIntro}
            />

            <GlassPanel className="mt-5 p-4 sm:p-5">
              <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
                <div>
                  <div className="mb-2 flex flex-wrap gap-2">
                    <MovieBadge label={typeLabel} />
                    <MovieBadge label={statusLabel} />
                    {content.dubber?.name ? <MovieBadge label={content.dubber.name} /> : null}
                  </div>
                  <h1 className="text-2xl font-bold tracking-[-0.018em] text-white">{content.title}</h1>
                  <p className="mt-2 max-w-3xl text-sm font-medium leading-6 tracking-[0.004em] text-zinc-300">
                    {content.description}
                  </p>
                </div>

                <div className="flex flex-wrap gap-2">
                  {["Болашақта көремін", "Көрдім", "Ұнады", "Telegram"].map((item) => (
                    <button
                      key={item}
                      className="glass-button rounded-full px-4 py-2 text-sm font-semibold tracking-[0.01em] text-white"
                    >
                      {item}
                    </button>
                  ))}
                </div>
              </div>
            </GlassPanel>
          </div>

          <RelatedMoviesPanel
            className="xl:sticky xl:top-24"
            current={content}
            movies={relatedMovies}
          />
        </div>
      </div>
    </main>
  );
}
