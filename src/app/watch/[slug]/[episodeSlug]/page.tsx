import Link from "next/link";
import { notFound } from "next/navigation";
import { ChevronLeft, ChevronRight, Play } from "lucide-react";
import { HlsPlayer } from "@/components/player/hls-player";
import { GlassPanel } from "@/components/glass/glass-panel";
import { MovieBadge } from "@/components/movie/movie-badge";
import { contentStatusLabels, contentTypeLabels, isEpisodicType } from "@/features/content/format";
import { getMovieBySlug } from "@/features/movies/queries";
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
  const content = await getMovieBySlug(slug);

  if (!content || !isEpisodicType(content.type)) {
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

  return (
    <main className="min-h-screen px-4 pb-20 pt-24 sm:px-6 lg:px-8">
      <div className="mx-auto w-full max-w-7xl">
        <HlsPlayer
          poster={getMovieImageSrc(episode.thumbnailUrl ?? content.backdropUrl, "backdrop")}
          src={episode.hlsUrl}
          languages={content.languages}
        />

        <GlassPanel className="mt-5 p-4 sm:p-5">
          <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
            <div>
              <div className="mb-2 flex flex-wrap gap-2">
                <MovieBadge label={typeLabel} />
                <MovieBadge label={statusLabel} />
                {content.dubber?.name ? <MovieBadge label={content.dubber.name} /> : null}
                <MovieBadge label={`${episode.episodeNumber}-серия`} />
              </div>
              <h1 className="text-2xl font-semibold text-white">
                {content.title} — {episode.episodeNumber}-серия
              </h1>
              {episode.title ? (
                <p className="mt-2 text-base font-medium text-[var(--accent)]">{episode.title}</p>
              ) : null}
              <p className="mt-2 max-w-3xl text-sm leading-6 text-zinc-300">
                {episode.description || content.description}
              </p>
            </div>

            <div className="flex flex-wrap gap-2">
              <EpisodeNavLink episode={previousEpisode} slug={content.slug} direction="previous" />
              <EpisodeNavLink episode={nextEpisode} slug={content.slug} direction="next" />
            </div>
          </div>
        </GlassPanel>

        <section className="mt-6">
          <div className="mb-4 flex items-center justify-between gap-4">
            <div>
              <h2 className="text-2xl font-semibold tracking-tight text-white">Сериялар</h2>
              <div className="mt-2 h-px w-24 bg-gradient-to-r from-[var(--accent)] to-transparent" />
            </div>
            <Link href={`/${content.slug}`} className="glass-button rounded-full px-4 py-2 text-sm font-semibold text-white">
              Detail page
            </Link>
          </div>

          <div className="grid gap-2 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-5">
            {episodes.map((item) => {
              const active = item.id === episode.id;

              return (
                <Link
                  key={item.id}
                  href={`/watch/${content.slug}/${item.slug}`}
                  className={
                    active
                      ? "rounded-2xl border border-[rgba(217,183,111,0.42)] bg-[rgba(217,183,111,0.16)] px-4 py-3 text-sm font-semibold text-[var(--accent)]"
                      : "glass-button rounded-2xl px-4 py-3 text-sm font-semibold text-white"
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
      <span className="rounded-full border border-white/10 bg-white/[0.04] px-4 py-2 text-sm font-semibold text-zinc-600">
        {label}
      </span>
    );
  }

  return (
    <Link
      href={`/watch/${slug}/${episode.slug}`}
      className="glass-button inline-flex items-center gap-2 rounded-full px-4 py-2 text-sm font-semibold text-white"
    >
      {direction === "previous" ? <ChevronLeft className="h-4 w-4" /> : null}
      {label}
      {direction === "next" ? <ChevronRight className="h-4 w-4" /> : null}
    </Link>
  );
}
