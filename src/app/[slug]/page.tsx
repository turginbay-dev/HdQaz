import Link from "next/link";
import type { ReactNode } from "react";
import { notFound } from "next/navigation";
import { Calendar, Clapperboard, Crown, Globe2, Play, Radio } from "lucide-react";
import { CommentsSection } from "@/components/engagement/comments-section";
import { MovieEngagementActions } from "@/components/engagement/movie-engagement-actions";
import { MovieViewTracker } from "@/components/engagement/movie-view-tracker";
import { GlassPanel } from "@/components/glass/glass-panel";
import { MovieImage } from "@/components/movie/movie-image";
import { MovieBadge } from "@/components/movie/movie-badge";
import { MovieRow } from "@/components/movie/movie-row";
import { EpisodesSection } from "@/components/player/episodes-section";
import { HlsPlayer } from "@/components/player/hls-player";
import { PremiumLockScreen } from "@/components/premium/premium-lock-screen";
import { contentStatusLabels, contentTypeLabels, isEpisodicContent } from "@/features/content/format";
import { getEngagementState, getMovieEngagementStats, listMovieComments } from "@/features/engagement/repository";
import { getAllMovies, getMovieBySlug, getRelatedMovies } from "@/features/movies/queries";
import { getViewerContext } from "@/features/users/session";
import { getWatchProgressForContent } from "@/features/watch-history/repository";
import { getMovieImageSrc } from "@/lib/movie-images";
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

export default async function ContentPage({ params, searchParams }: ContentPageProps) {
  const { slug } = await params;
  const query = await searchParams;
  const [content, movies, viewer] = await Promise.all([getMovieBySlug(slug), getAllMovies(), getViewerContext()]);

  if (!content) {
    notFound();
  }

  const typeLabel = content.type ? contentTypeLabels[content.type] : "Movie";
  const statusLabel = content.status ? contentStatusLabels[content.status] : "Аяқталған";
  const episodes = content.episodes ?? [];
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
  const relatedMovies = getRelatedMovies(movies, content, 12);
  const [engagementState, comments, stats, watchProgress] = await Promise.all([
    getEngagementState(viewer.user?.id, content.id),
    listMovieComments(content.id, { isAdmin: viewer.isAdmin }),
    getMovieEngagementStats(content.id),
    viewer.user ? getWatchProgressForContent(viewer.user.id, content.id) : Promise.resolve(null)
  ]);
  const canWatch = !content.isPremium || viewer.premium.isPremium || viewer.isAdmin;
  const playerStreamUrl = selectedEpisode ? selectedEpisode.hlsUrl : content.hlsUrl ?? content.streams.master;
  const playerPoster = getMovieImageSrc(selectedEpisode?.thumbnailUrl ?? content.backdropUrl, "backdrop");
  const skipIntro = getSkipIntro(selectedEpisode ?? content);

  return (
    <main className="min-h-screen pb-20">
      <section className="relative min-h-[72svh] overflow-hidden sm:min-h-[78vh]">
        <MovieImage
          src={content.backdropUrl}
          alt=""
          fallback="backdrop"
          fill
          priority
          sizes="100vw"
          className="absolute inset-0 h-full w-full object-cover"
        />
        <div className="absolute inset-0 bg-gradient-to-r from-black via-black/72 to-black/20" />
        <div className="absolute inset-0 bg-gradient-to-t from-[var(--background)] via-transparent to-black/40" />

        <div className="relative mx-auto flex min-h-[72svh] w-full max-w-7xl items-end px-4 pb-10 pt-28 sm:min-h-[78vh] sm:px-6 sm:pb-14 sm:pt-32 lg:px-8">
          <div className="grid w-full gap-8 lg:grid-cols-[minmax(0,1fr)_340px] lg:items-end">
            <div className="max-w-3xl">
              <div className="mb-4 flex flex-wrap gap-2">
                <MovieBadge label={typeLabel} />
                <MovieBadge label={statusLabel} />
                {content.isPremium ? <MovieBadge label="Premium" /> : null}
              </div>
              <h1 className="break-words text-[clamp(2.55rem,11vw,3.4rem)] font-bold tracking-[-0.028em] text-white sm:text-7xl">
                {content.title}
              </h1>
              <p className="mt-4 max-w-2xl text-base font-medium leading-7 tracking-[0.004em] text-zinc-200 sm:text-lg sm:leading-8">
                {content.description}
              </p>
              <div className="mt-5 flex flex-wrap gap-2">
                {content.genres.map((genre) => (
                  <span
                    key={genre}
                    className="glass-button rounded-full px-3 py-1.5 text-xs font-semibold tracking-[0.01em] text-white"
                  >
                    {genre}
                  </span>
                ))}
              </div>

              <div className="mt-6 grid max-w-2xl grid-cols-2 gap-3 sm:grid-cols-4">
                <InfoTile icon={<Calendar className="h-4 w-4" />} label="Жылы" value={String(content.year)} />
                <InfoTile icon={<Globe2 className="h-4 w-4" />} label="Елі" value={content.country || "Белгісіз"} />
                <InfoTile icon={<Clapperboard className="h-4 w-4" />} label="Түрі" value={typeLabel} />
                <InfoTile icon={<Radio className="h-4 w-4" />} label="Статус" value={statusLabel} />
              </div>
              {content.dubber ? <HeroDubberInfo dubber={content.dubber} /> : null}
              {content.isPremium ? (
                <div className="mt-4 inline-flex items-center gap-2 rounded-full border border-[rgba(217,183,111,0.24)] bg-[rgba(217,183,111,0.1)] px-3 py-1.5 text-xs font-bold text-[var(--accent)]">
                  <Crown className="h-3.5 w-3.5" />
                  Premium
                </div>
              ) : null}
            </div>

            <GlassPanel className="hidden p-4 lg:block">
              <MovieImage
                src={content.posterUrl}
                alt={content.title}
                fallback="poster"
                width={680}
                height={1020}
                className="aspect-[2/3] w-full rounded-md object-cover"
              />
            </GlassPanel>
          </div>
        </div>
      </section>

      <section id="player" className="relative z-10 -mt-5 scroll-mt-24 px-3 sm:-mt-3 sm:px-6 lg:px-8">
        <div className="mx-auto w-full max-w-7xl">
          {canWatch && playerStreamUrl ? (
            <>
              <MovieViewTracker movieSlug={content.slug} />
              <HlsPlayer
                contentId={viewer.user ? content.id : undefined}
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
            <UnavailablePlayer title={content.title} />
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
          {contentIsEpisodic ? (
            <EpisodesSection
              contentSlug={content.slug}
              episodes={episodes}
              selectedEpisodeId={selectedEpisode?.id ?? null}
            />
          ) : null}
        </div>
      </section>

      <div className="mx-auto mt-14 w-full max-w-7xl px-4 sm:px-6 lg:px-8">
        <div className="mb-14">
          <CommentsSection
            comments={comments}
            currentUserId={viewer.user?.id ?? null}
            isAdmin={viewer.isAdmin}
            isAuthenticated={Boolean(viewer.user)}
            movieSlug={content.slug}
          />
        </div>

        <div className="mb-14">
          <MovieRow
            title="Ұқсас контент"
            href={content.genres[0] ? { pathname: "/catalog", query: { genre: content.genres[0] } } : "/catalog"}
            movies={relatedMovies}
          />
        </div>
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

function UnavailablePlayer({ title }: { title: string }) {
  return (
    <GlassPanel className="relative overflow-hidden p-0">
      <div className="flex aspect-video min-h-[210px] items-center justify-center rounded-[18px] bg-black px-5 text-center sm:min-h-[280px] sm:rounded-[28px]">
        <div>
          <span className="mx-auto flex h-14 w-14 items-center justify-center rounded-full border border-white/10 bg-white/[0.06] text-[var(--accent)]">
            <Play className="h-5 w-5 fill-current" />
          </span>
          <h2 className="mt-4 text-xl font-bold tracking-[-0.018em] text-white sm:text-2xl">{title}</h2>
          <p className="mx-auto mt-2 max-w-md text-sm font-medium leading-6 text-zinc-400">
            Видео жақында қосылады.
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

function InfoTile({
  icon,
  label,
  value
}: {
  icon: ReactNode;
  label: string;
  value: string;
}) {
  return (
    <div className="glass rounded-2xl p-3">
      <div className="mb-2 text-[var(--accent)]">{icon}</div>
      <p className="text-[10px] uppercase tracking-[0.2em] text-zinc-500">{label}</p>
      <p className="mt-1 truncate text-sm font-semibold text-white">{value}</p>
    </div>
  );
}
