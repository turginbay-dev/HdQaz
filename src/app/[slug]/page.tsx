import Link from "next/link";
import type { ReactNode } from "react";
import { notFound } from "next/navigation";
import { Calendar, Clapperboard, Crown, Eye, Globe2, Play, Radio } from "lucide-react";
import { AdminStatsPills } from "@/components/engagement/admin-stats-pills";
import { CommentsSection } from "@/components/engagement/comments-section";
import { MovieEngagementActions } from "@/components/engagement/movie-engagement-actions";
import { GlassPanel } from "@/components/glass/glass-panel";
import { MovieImage } from "@/components/movie/movie-image";
import { MovieBadge } from "@/components/movie/movie-badge";
import { MovieRow } from "@/components/movie/movie-row";
import { WatchButton } from "@/components/ui/watch-button";
import { contentStatusLabels, contentTypeLabels, isEpisodicContent } from "@/features/content/format";
import { getEngagementState, getMovieEngagementStats, listMovieComments } from "@/features/engagement/repository";
import { getAllMovies, getMovieBySlug, getRelatedMovies } from "@/features/movies/queries";
import { getViewerContext } from "@/features/users/session";
import { formatViewLabel } from "@/lib/formatters";
import type { Movie } from "@/types/movie";

export const dynamic = "force-dynamic";

type ContentPageProps = {
  params: Promise<{
    slug: string;
  }>;
};

export default async function ContentPage({ params }: ContentPageProps) {
  const { slug } = await params;
  const [content, movies, viewer] = await Promise.all([getMovieBySlug(slug), getAllMovies(), getViewerContext()]);

  if (!content) {
    notFound();
  }

  const typeLabel = content.type ? contentTypeLabels[content.type] : "Movie";
  const statusLabel = content.status ? contentStatusLabels[content.status] : "Аяқталған";
  const episodes = content.episodes ?? [];
  const contentIsEpisodic = isEpisodicContent(content);
  const relatedMovies = getRelatedMovies(movies, content, 12);
  const [engagementState, comments, stats] = await Promise.all([
    getEngagementState(viewer.user?.id, content.id),
    listMovieComments(content.id, { isAdmin: viewer.isAdmin }),
    getMovieEngagementStats(content.id)
  ]);

  return (
    <main className="min-h-screen pb-20">
      <section className="relative min-h-[78vh] overflow-hidden">
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

        <div className="relative mx-auto flex min-h-[78vh] w-full max-w-7xl items-end px-4 pb-14 pt-32 sm:px-6 lg:px-8">
          <div className="grid w-full gap-8 lg:grid-cols-[minmax(0,1fr)_340px] lg:items-end">
            <div className="max-w-3xl">
              <div className="mb-4 flex flex-wrap gap-2">
                <MovieBadge label={typeLabel} />
                <MovieBadge label={statusLabel} />
                {content.dubber?.name ? <MovieBadge label={content.dubber.name} /> : null}
                {content.isPremium ? <MovieBadge label="Premium" /> : null}
              </div>
              <h1 className="text-5xl font-bold tracking-[-0.028em] text-white sm:text-7xl">
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
              <div className="mt-3 inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/[0.08] px-3 py-1.5 text-xs font-semibold text-zinc-200 backdrop-blur-2xl">
                <Eye className="h-3.5 w-3.5 text-[var(--accent)]" />
                {formatViewLabel(stats.views)}
              </div>

              <div className="mt-8 flex flex-wrap gap-3">
                {contentIsEpisodic && episodes[0] ? (
                  <WatchButton href={`/watch/${content.slug}/${episodes[0].slug}`} />
                ) : !contentIsEpisodic ? (
                  <WatchButton href={`/watch/${content.slug}`} />
                ) : null}
                <MovieEngagementActions
                  initialLiked={engagementState.isLiked}
                  initialWatchlisted={engagementState.isWatchlisted}
                  isAuthenticated={Boolean(viewer.user)}
                  movieSlug={content.slug}
                />
              </div>
              {content.isPremium ? (
                <div className="mt-4 inline-flex items-center gap-2 rounded-full border border-[rgba(217,183,111,0.24)] bg-[rgba(217,183,111,0.1)] px-3 py-1.5 text-xs font-bold text-[var(--accent)]">
                  <Crown className="h-3.5 w-3.5" />
                  Premium
                </div>
              ) : null}
              {viewer.isAdmin ? <div className="mt-4"><AdminStatsPills stats={stats} /></div> : null}
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

      <div className="mx-auto w-full max-w-7xl px-4 sm:px-6 lg:px-8">
        {contentIsEpisodic ? (
          <section className="mb-14">
            <div className="mb-5">
              <h2 className="text-2xl font-bold tracking-[-0.024em] text-white sm:text-3xl">Episodes</h2>
              <div className="mt-2 h-px w-24 bg-gradient-to-r from-[var(--accent)] to-transparent" />
            </div>
            {episodes.length > 0 ? (
              <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
                {episodes.map((episode) => (
                  <Link
                    key={episode.id}
                    href={`/watch/${content.slug}/${episode.slug}`}
                    className="glass group rounded-[24px] p-4 transition hover:border-[rgba(217,183,111,0.35)]"
                  >
                    <p className="text-sm font-bold tracking-[0.01em] text-[var(--accent)]">
                      {episode.episodeNumber}-серия
                    </p>
                    <h3 className="mt-2 line-clamp-2 min-h-10 text-base font-bold tracking-[-0.012em] text-white">
                      {episode.title || `${episode.episodeNumber}-серия`}
                    </h3>
                    <p className="mt-3 inline-flex items-center gap-2 text-sm font-semibold tracking-[0.01em] text-zinc-300 transition group-hover:text-white">
                      <Play className="h-4 w-4 fill-current" />
                      Көру
                    </p>
                  </Link>
                ))}
              </div>
            ) : (
              <div className="glass-strong rounded-[30px] p-8 text-center text-lg font-semibold text-white">
                Сериялар жақында қосылады
              </div>
            )}
          </section>
        ) : null}

        <div className="mb-14">
          <CommentsSection
            comments={comments}
            currentUserId={viewer.user?.id ?? null}
            isAdmin={viewer.isAdmin}
            isAuthenticated={Boolean(viewer.user)}
            movieSlug={content.slug}
          />
        </div>

        {content.dubber ? (
          <section className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_320px] lg:items-start">
            <div className="min-w-0">
              <MovieRow
                title="Ұқсас контент"
                href={content.genres[0] ? { pathname: "/catalog", query: { genre: content.genres[0] } } : "/catalog"}
                movies={relatedMovies}
              />
            </div>
            <CompactDubberPanel dubber={content.dubber} />
          </section>
        ) : (
          <MovieRow
            title="Ұқсас контент"
            href={content.genres[0] ? { pathname: "/catalog", query: { genre: content.genres[0] } } : "/catalog"}
            movies={relatedMovies}
          />
        )}
      </div>
    </main>
  );
}

function CompactDubberPanel({ dubber }: { dubber: NonNullable<Movie["dubber"]> }) {
  return (
    <GlassPanel className="p-4 lg:sticky lg:top-24">
      <div className="flex min-w-0 items-center gap-3">
        {dubber.logoUrl ? (
          <img
            src={dubber.logoUrl}
            alt={dubber.name}
            className="h-11 w-11 shrink-0 rounded-xl object-cover"
          />
        ) : (
          <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-[rgba(217,183,111,0.16)] text-[var(--accent)]">
            <Radio className="h-5 w-5" />
          </div>
        )}
        <div className="min-w-0">
          <p className="text-[10px] font-semibold uppercase tracking-[0.2em] text-zinc-500">Даббер</p>
          <h2 className="truncate text-base font-semibold text-white">{dubber.name}</h2>
        </div>
      </div>
      {dubber.description ? (
        <p className="mt-3 line-clamp-2 text-sm leading-6 text-zinc-400">{dubber.description}</p>
      ) : null}
      <div className="mt-4 flex flex-wrap gap-2">
        {[
          ["Telegram", dubber.telegramUrl],
          ["VK", dubber.vkUrl],
          ["Support", dubber.supportUrl],
          ["Chat", dubber.chatUrl]
        ].map(([label, href]) =>
          href ? (
            <Link
              key={label}
              href={href}
              className="glass-button rounded-full px-3 py-1.5 text-xs font-semibold text-white"
            >
              {label}
            </Link>
          ) : null
        )}
      </div>
    </GlassPanel>
  );
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
