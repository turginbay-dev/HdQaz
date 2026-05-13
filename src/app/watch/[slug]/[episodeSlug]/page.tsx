import Link from "next/link";
import { notFound } from "next/navigation";
import { ChevronLeft, ChevronRight, Play } from "lucide-react";
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

type EpisodeWatchPageProps = {
  params: Promise<{
    episodeSlug: string;
    slug: string;
  }>;
};

export default async function EpisodeWatchPage({ params }: EpisodeWatchPageProps) {
  const { episodeSlug, slug } = await params;
  const [content, movies, viewer] = await Promise.all([getMovieBySlug(slug), getAllMovies(), getViewerContext()]);

  if (!content || !isEpisodicContent(content)) {
    notFound();
  }

  const episodes = content.episodes ?? [];
  const episodeIndex = episodes.findIndex((item) => item.slug === episodeSlug);
  const episode = episodeIndex >= 0 ? episodes[episodeIndex] : null;

  if (!episode) {
    notFound();
  }

  const previousEpisode = episodeIndex > 0 ? episodes[episodeIndex - 1] : null;
  const nextEpisode = episodeIndex < episodes.length - 1 ? episodes[episodeIndex + 1] : null;
  const typeLabel = content.type ? contentTypeLabels[content.type] : "Series";
  const statusLabel = content.status ? contentStatusLabels[content.status] : "Жалғасуда";
  const relatedMovies = getRelatedMovies(movies, content, 6);
  const [engagementState, stats] = await Promise.all([
    getEngagementState(viewer.user?.id, content.id),
    getMovieEngagementStats(content.id)
  ]);
  const canWatch = !content.isPremium || viewer.premium.isPremium || viewer.isAdmin;
  const skipIntro =
    typeof episode.introStartSeconds === "number" &&
    typeof episode.introEndSeconds === "number" &&
    episode.introEndSeconds > episode.introStartSeconds
      ? {
          startSeconds: episode.introStartSeconds,
          endSeconds: episode.introEndSeconds,
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
            {canWatch ? (
              <>
                <MovieViewTracker movieSlug={content.slug} />
                <HlsPlayer
                  poster={getMovieImageSrc(episode.thumbnailUrl ?? content.backdropUrl, "backdrop")}
                  src={episode.hlsUrl}
                  languages={content.languages}
                  progressKey={`episode:${content.slug}:${episode.slug}`}
                  skipIntro={skipIntro}
                  nextEpisode={
                    nextEpisode
                      ? {
                          href: `/watch/${content.slug}/${nextEpisode.slug}`,
                          label: "Келесі серия",
                          title: nextEpisode.title ?? `${nextEpisode.episodeNumber}-серия`
                        }
                      : null
                  }
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
                    <MovieBadge label={`${episode.episodeNumber}-серия`} />
                    {content.isPremium ? <MovieBadge label="Premium" /> : null}
                  </div>
                  <h1 className="text-2xl font-bold tracking-[-0.018em] text-white">
                    {content.title} - {episode.episodeNumber}-серия
                  </h1>
                  <div className="mt-2">
                    <ViewCountPill views={stats.views} />
                  </div>
                  {episode.title ? (
                    <p className="mt-2 text-base font-semibold tracking-[0.006em] text-[var(--accent)]">{episode.title}</p>
                  ) : null}
                  <p className="mt-2 max-w-3xl text-sm font-medium leading-6 tracking-[0.004em] text-zinc-300">
                    {episode.description || content.description}
                  </p>
                  {viewer.isAdmin ? <div className="mt-3"><AdminStatsPills stats={stats} /></div> : null}
                </div>

                <div className="flex flex-col gap-3">
                  <MovieEngagementActions
                    initialLiked={engagementState.isLiked}
                    initialWatchlisted={engagementState.isWatchlisted}
                    isAuthenticated={Boolean(viewer.user)}
                    movieSlug={content.slug}
                  />
                  <div className="flex flex-wrap gap-2">
                  <EpisodeNavLink episode={previousEpisode} slug={content.slug} direction="previous" />
                  <EpisodeNavLink episode={nextEpisode} slug={content.slug} direction="next" />
                  </div>
                </div>
              </div>
            </GlassPanel>

            <section className="mt-6">
              <div className="mb-4 flex items-center justify-between gap-4">
                <div>
                  <h2 className="text-2xl font-bold tracking-[-0.024em] text-white">Сериялар</h2>
                  <div className="mt-2 h-px w-24 bg-gradient-to-r from-[var(--accent)] to-transparent" />
                </div>
                <Link href={`/${content.slug}`} className="glass-button rounded-full px-4 py-2 text-sm font-semibold tracking-[0.01em] text-white">
                  Detail page
                </Link>
              </div>

              <div className="grid gap-2 sm:grid-cols-2 md:grid-cols-3 xl:grid-cols-4">
                {episodes.map((item) => {
                  const active = item.id === episode.id;

                  return (
                    <Link
                      key={item.id}
                      href={`/watch/${content.slug}/${item.slug}`}
                      className={
                        active
                          ? "rounded-2xl border border-[rgba(217,183,111,0.42)] bg-[rgba(217,183,111,0.16)] px-4 py-3 text-sm font-semibold tracking-[0.01em] text-[var(--accent)]"
                          : "glass-button rounded-2xl px-4 py-3 text-sm font-semibold tracking-[0.01em] text-white"
                      }
                    >
                      <span className="inline-flex items-center gap-2">
                        <Play className="h-4 w-4 fill-current" />
                        {item.episodeNumber}-серия
                      </span>
                    </Link>
                  );
                })}
              </div>
            </section>
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

function EpisodeNavLink({
  direction,
  episode,
  slug
}: {
  direction: "next" | "previous";
  episode: { episodeNumber: number; slug: string } | null;
  slug: string;
}) {
  const label = direction === "previous" ? "Алдыңғы серия" : "Келесі серия";

  if (!episode) {
    return (
      <span className="rounded-full border border-white/10 bg-white/[0.04] px-4 py-2 text-sm font-semibold tracking-[0.01em] text-zinc-600">
        {label}
      </span>
    );
  }

  return (
    <Link
      href={`/watch/${slug}/${episode.slug}`}
      className="glass-button inline-flex items-center gap-2 rounded-full px-4 py-2 text-sm font-semibold tracking-[0.01em] text-white"
    >
      {direction === "previous" ? <ChevronLeft className="h-4 w-4" /> : null}
      {label}
      {direction === "next" ? <ChevronRight className="h-4 w-4" /> : null}
    </Link>
  );
}
