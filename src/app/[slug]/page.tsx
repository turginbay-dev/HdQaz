import Link from "next/link";
import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { Play, Radio } from "lucide-react";
import { CommentsSection } from "@/components/engagement/comments-section";
import { MovieEngagementActions } from "@/components/engagement/movie-engagement-actions";
import { MovieViewTracker } from "@/components/engagement/movie-view-tracker";
import { GlassPanel } from "@/components/glass/glass-panel";
import { MovieImage } from "@/components/movie/movie-image";
import { MovieRow } from "@/components/movie/movie-row";
import { ReadMoreDescription } from "@/components/movie/read-more-description";
import { EpisodesSection } from "@/components/player/episodes-section";
import { HlsPlayer } from "@/components/player/lazy-player";
import { PremiumLockScreen } from "@/components/premium/premium-lock-screen";
import { contentStatusLabels, isEpisodicContent } from "@/features/content/format";
import { getEngagementState, getMovieEngagementStats, listMovieComments } from "@/features/engagement/repository";
import { getAllMovies, getMovieBySlug } from "@/features/movies/queries";
import { getViewerContext } from "@/features/users/session";
import { getWatchProgressForContent } from "@/features/watch-history/repository";
import { getMovieImageSrc } from "@/lib/movie-images";
import { getCanonicalUrl } from "@/lib/site-url";
import { categoryLabel, displayTitles, selectViewerRelated } from "@/lib/viewer-catalog";
import type { Movie } from "@/types/movie";

export const dynamic = "force-dynamic";

type ContentPageProps = {
  params: Promise<{
    slug: string;
  }>;
  searchParams?: Promise<{
    episode?: string | string[];
  }>;
};

function getSearchParam(value?: string | string[]) {
  return Array.isArray(value) ? value[0] : value;
}

export async function generateMetadata({ params }: ContentPageProps): Promise<Metadata> {
  const { slug } = await params;
  const content = await getMovieBySlug(slug);
  if (!content) return { robots: { index: false, follow: false } };
  const canonical = getCanonicalUrl(`/${encodeURIComponent(slug)}`);

  return {
    title: `${content.title} — HD Qaz`,
    description: content.description.slice(0, 180),
    alternates: {
      canonical
    },
    openGraph: {
      title: content.title,
      description: content.description.slice(0, 180),
      images: [getMovieImageSrc(content.backdropUrl || content.posterUrl, "backdrop")],
      url: canonical
    }
  };
}

export default async function ContentPage({ params, searchParams }: ContentPageProps) {
  const { slug } = await params;
  const query = await searchParams;
  const [content, movies, viewer] = await Promise.all([getMovieBySlug(slug), getAllMovies(), getViewerContext()]);

  if (!content) {
    notFound();
  }

  const typeLabel = categoryLabel(content);
  const titles = displayTitles(content);
  const statusLabel = content.status ? contentStatusLabels[content.status] : "Аяқталған";
  const episodes = [...(content.episodes ?? [])].sort((a, b) => (a.seasonNumber ?? 1) - (b.seasonNumber ?? 1) || a.episodeNumber - b.episodeNumber);
  const contentIsEpisodic = isEpisodicContent(content);
  const selectedEpisodeSlug = getSearchParam(query?.episode);
  const selectedEpisode = contentIsEpisodic
    ? episodes.find((episode) => episode.slug === selectedEpisodeSlug) ?? episodes[0] ?? null
    : null;
  const selectedEpisodeIndex = selectedEpisode
    ? episodes.findIndex((episode) => episode.id === selectedEpisode.id)
    : -1;
  const nextEpisode =
    selectedEpisodeIndex >= 0 && selectedEpisodeIndex < episodes.length - 1
      ? episodes[selectedEpisodeIndex + 1]
      : null;
  const relatedMovies = selectViewerRelated(movies, content, 6);
  const [engagementState, comments, stats, watchProgress] = await Promise.all([
    getEngagementState(viewer.user?.id, content.id),
    listMovieComments(content.id, { isAdmin: viewer.isAdmin }),
    getMovieEngagementStats(content.id),
    viewer.user && !contentIsEpisodic ? getWatchProgressForContent(viewer.user.id, content.id) : Promise.resolve(null)
  ]);
  const canWatch = !content.isPremium || viewer.premium.isPremium || viewer.isAdmin;
  const playerStreamUrl = contentIsEpisodic ? selectedEpisode?.hlsUrl : content.hlsUrl ?? content.streams.master;
  const playerPoster = getMovieImageSrc(selectedEpisode?.thumbnailUrl ?? content.backdropUrl, "backdrop");
  const skipIntro = getSkipIntro(selectedEpisode ?? content);

  return (
    <main className="detail-page" id="main-content">
      <section className="viewer-container detail-heading">
        <Link className="detail-back" href="/catalog">← Каталог</Link>
        <div className="detail-identity">
          <div className="detail-poster">
            <MovieImage src={content.posterUrl} fallback="poster" alt={titles.title} fill priority sizes="(max-width: 639px) 112px, (max-width: 1023px) 260px, 300px" className="object-cover" />
          </div>
          <div className="detail-summary">
            <h1>{titles.title}</h1>
            {titles.original && <p className="detail-original">{titles.original}</p>}
            <p className="detail-meta">{[content.year, content.country, typeLabel, ...content.genres].filter(Boolean).join(" · ")}</p>
            <p className="detail-meta">{[statusLabel, content.durationMinutes ? `${content.durationMinutes} мин` : content.runtime, content.isPremium ? "Premium" : null].filter(Boolean).join(" · ")}</p>
          </div>
          <div className="detail-synopsis"><ReadMoreDescription description={content.description} /></div>
          <div className="detail-cta"><a href="#player" className="primary-button detail-watch"><Play size={16} />Көру</a></div>
          {content.dubber ? <div className="detail-dubber"><HeroDubberInfo dubber={content.dubber} /></div> : null}
        </div>
      </section>
      {contentIsEpisodic && <div className="viewer-container detail-episodes">
        <EpisodesSection
          contentSlug={content.slug}
          episodes={episodes}
          selectedEpisodeId={selectedEpisode?.id ?? null}
        />
      </div>}
      <section id="player" className="viewer-container detail-player">
        <div>
          {canWatch && playerStreamUrl ? (
            <>
              <MovieViewTracker movieSlug={content.slug} />
              <HlsPlayer
                key={selectedEpisode?.id ?? content.id}
                progressKey={selectedEpisode ? `watch-progress:episode:${selectedEpisode.id}` : `watch-progress:movie:${content.id}`}
                contentId={viewer.user && !contentIsEpisodic ? content.id : undefined}
                initialWatchProgress={watchProgress}
                poster={playerPoster}
                src={playerStreamUrl}
                languages={content.languages}
                skipIntro={skipIntro}
                nextEpisode={
                  nextEpisode
                    ? {
                        href: episodePlayerHref(content.slug, nextEpisode.slug),
                        label: "Келесі серия",
                        title: nextEpisode.title ?? `${nextEpisode.episodeNumber}-серия`
                      }
                    : null
                }
              />
            </>
          ) : canWatch ? (
            <UnavailablePlayer title={content.title} episodic={contentIsEpisodic} />
          ) : (
            <PremiumLockScreen backdropUrl={content.backdropUrl} title={content.title} />
          )}
          <MovieEngagementActions
            initialLiked={engagementState.isLiked}
            initialWatchlisted={engagementState.isWatchlisted}
            isAuthenticated={Boolean(viewer.user)}
            movieSlug={content.slug}
            stats={stats}
            variant="player-row"
          />
        </div>
      </section>

      <div className="viewer-container detail-information">
        <div className="mb-14">
          <CommentsSection
            comments={comments}
            currentUserId={viewer.user?.id ?? null}
            isAdmin={viewer.isAdmin}
            isAuthenticated={Boolean(viewer.user)}
            movieSlug={content.slug}
          />
        </div>

        {relatedMovies.length > 0 && <div className="mb-14">
          <MovieRow
            title="Ұқсас контент"
            href={content.genres[0] ? { pathname: "/catalog", query: { genre: content.genres[0] } } : "/catalog"}
            movies={relatedMovies}
          />
        </div>}
      </div>
    </main>
  );
}

function HeroDubberInfo({ dubber }: { dubber: NonNullable<Movie["dubber"]> }) {
  const links = [
    ["Telegram", dubber.telegramUrl],
    ["VK", dubber.vkUrl],
    ["Support", dubber.supportUrl],
    ["Chat", dubber.chatUrl]
  ] as const;

  return (
    <div className="mt-4 flex max-w-2xl flex-col gap-3 rounded-2xl border border-white/10 bg-white/[0.075] p-3 backdrop-blur-2xl sm:flex-row sm:items-center sm:justify-between">
      <div className="flex min-w-0 items-center gap-3">
        {dubber.logoUrl ? (
          <img src={dubber.logoUrl} alt={dubber.name} className="h-10 w-10 shrink-0 rounded-xl object-cover" />
        ) : (
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-[rgba(217,183,111,0.16)] text-[var(--accent)]">
            <Radio className="h-5 w-5" />
          </div>
        )}
        <div className="min-w-0">
          <p className="text-[10px] font-semibold uppercase tracking-[0.2em] text-zinc-500">Дыбыстаушы</p>
          <h2 className="truncate text-sm font-semibold text-white">{dubber.name}</h2>
          {dubber.description ? <p className="mt-0.5 line-clamp-1 text-xs leading-5 text-zinc-400">{dubber.description}</p> : null}
        </div>
      </div>
      <div className="flex shrink-0 flex-wrap gap-2">
        {links.map(([label, href]) =>
          href ? (
            <Link
              key={label}
              href={href}
              className="rounded-full border border-white/10 bg-black/20 px-3 py-1.5 text-xs font-semibold text-zinc-200 transition hover:border-white/25 hover:text-white"
            >
              {label}
            </Link>
          ) : null
        )}
      </div>
    </div>
  );
}

function UnavailablePlayer({ title, episodic }: { title: string; episodic: boolean }) {
  return (
    <GlassPanel className="relative overflow-hidden p-0">
      <div className="flex aspect-video items-center justify-center rounded-[18px] bg-black px-5 text-center sm:rounded-[28px]">
        <div>
          <span className="mx-auto flex h-14 w-14 items-center justify-center rounded-full border border-white/10 bg-white/[0.06] text-[var(--accent)]">
            <Play className="h-5 w-5 fill-current" />
          </span>
          <h2 className="mt-4 text-xl font-bold tracking-[-0.018em] text-white sm:text-2xl">{title}</h2>
          <p className="mx-auto mt-2 max-w-md text-sm font-medium leading-6 text-zinc-400">
            {episodic ? "Бұл серия әзірге қолжетімсіз." : "Жақында"}
          </p>
        </div>
      </div>
    </GlassPanel>
  );
}

function episodePlayerHref(contentSlug: string, episodeSlug: string) {
  return `/${contentSlug}?episode=${encodeURIComponent(episodeSlug)}#player`;
}

function getSkipIntro(source: {
  introEndSeconds?: number | null;
  introStartSeconds?: number | null;
}) {
  return typeof source.introStartSeconds === "number" &&
    typeof source.introEndSeconds === "number" &&
    source.introEndSeconds > source.introStartSeconds
    ? {
        startSeconds: source.introStartSeconds,
        endSeconds: source.introEndSeconds,
        label: "Интроны өткізу"
      }
    : null;
}
