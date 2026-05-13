import { notFound, redirect } from "next/navigation";
import { AdminStatsPills } from "@/components/engagement/admin-stats-pills";
import { MovieEngagementActions } from "@/components/engagement/movie-engagement-actions";
import { MovieViewTracker } from "@/components/engagement/movie-view-tracker";
import { ViewCountPill } from "@/components/engagement/view-count-pill";
import { HlsPlayer } from "@/components/player/hls-player";
import { GlassPanel } from "@/components/glass/glass-panel";
import { MovieBadge } from "@/components/movie/movie-badge";
import { RelatedMoviesPanel } from "@/components/movie/related-movies-panel";
import { PremiumLockScreen } from "@/components/premium/premium-lock-screen";
import { contentStatusLabels, contentTypeLabels, isEpisodicContent } from "@/features/content/format";
import { getEngagementState, getMovieEngagementStats } from "@/features/engagement/repository";
import { getAllMovies, getMovieBySlug, getRelatedMovies } from "@/features/movies/queries";
import { getViewerContext } from "@/features/users/session";
import { getMovieImageSrc } from "@/lib/movie-images";

export const dynamic = "force-dynamic";

type WatchPageProps = {
  params: Promise<{
    slug: string;
  }>;
};

export default async function WatchPage({ params }: WatchPageProps) {
  const { slug } = await params;
  const [content, movies, viewer] = await Promise.all([getMovieBySlug(slug), getAllMovies(), getViewerContext()]);

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

  const typeLabel = content.type ? contentTypeLabels[content.type] : "Movie";
  const statusLabel = content.status ? contentStatusLabels[content.status] : "Аяқталған";
  const relatedMovies = getRelatedMovies(movies, content, 6);
  const [engagementState, stats] = await Promise.all([
    getEngagementState(viewer.user?.id, content.id),
    getMovieEngagementStats(content.id)
  ]);
  const canWatch = !content.isPremium || viewer.premium.isPremium || viewer.isAdmin;
  const streamUrl = canWatch ? content.hlsUrl ?? content.streams.master : null;

  if (canWatch && !streamUrl) {
    notFound();
  }

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
            {canWatch && streamUrl ? (
              <>
                <MovieViewTracker movieSlug={content.slug} />
                <HlsPlayer
                  poster={getMovieImageSrc(content.backdropUrl, "backdrop")}
                  src={streamUrl}
                  languages={content.languages}
                  progressKey={`movie:${content.slug}`}
                  skipIntro={skipIntro}
                />
              </>
            ) : (
              <PremiumLockScreen backdropUrl={content.backdropUrl} title={content.title} />
            )}

            <GlassPanel className="mt-5 p-4 sm:p-5">
              <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
                <div>
                  <div className="mb-2 flex flex-wrap gap-2">
                    <MovieBadge label={typeLabel} />
                    <MovieBadge label={statusLabel} />
                    {content.dubber?.name ? <MovieBadge label={content.dubber.name} /> : null}
                    {content.isPremium ? <MovieBadge label="Premium" /> : null}
                  </div>
                  <h1 className="text-2xl font-bold tracking-[-0.018em] text-white">{content.title}</h1>
                  <div className="mt-2">
                    <ViewCountPill views={stats.views} />
                  </div>
                  <p className="mt-2 max-w-3xl text-sm font-medium leading-6 tracking-[0.004em] text-zinc-300">
                    {content.description}
                  </p>
                  {viewer.isAdmin ? <div className="mt-3"><AdminStatsPills stats={stats} /></div> : null}
                </div>

                <MovieEngagementActions
                  initialLiked={engagementState.isLiked}
                  initialWatchlisted={engagementState.isWatchlisted}
                  isAuthenticated={Boolean(viewer.user)}
                  movieSlug={content.slug}
                />
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
