import Link from "next/link";
import type { ReactNode } from "react";
import { notFound } from "next/navigation";
import { Calendar, Clapperboard, Globe2, Play, Plus, Radio } from "lucide-react";
import { GlassPanel } from "@/components/glass/glass-panel";
import { MovieImage } from "@/components/movie/movie-image";
import { MovieBadge } from "@/components/movie/movie-badge";
import { MovieRow } from "@/components/movie/movie-row";
import { WatchButton } from "@/components/ui/watch-button";
import { contentStatusLabels, contentTypeLabels, isEpisodicType } from "@/features/content/format";
import { getAllMovies, getMovieBySlug, getTrendingMovies } from "@/features/movies/queries";

export const dynamic = "force-dynamic";

type ContentPageProps = {
  params: Promise<{
    slug: string;
  }>;
};

export default async function ContentPage({ params }: ContentPageProps) {
  const { slug } = await params;
  const [content, movies] = await Promise.all([getMovieBySlug(slug), getAllMovies()]);

  if (!content) {
    notFound();
  }

  const typeLabel = content.type ? contentTypeLabels[content.type] : "Movie";
  const statusLabel = content.status ? contentStatusLabels[content.status] : "Аяқталған";
  const episodes = content.episodes ?? [];

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
              </div>
              <h1 className="text-5xl font-semibold tracking-tight text-white sm:text-7xl">
                {content.title}
              </h1>
              <p className="mt-4 max-w-2xl text-base leading-7 text-zinc-200 sm:text-lg">
                {content.description}
              </p>
              <div className="mt-5 flex flex-wrap gap-2">
                {content.genres.map((genre) => (
                  <span
                    key={genre}
                    className="glass-button rounded-full px-3 py-1.5 text-xs font-semibold text-white"
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

              <div className="mt-8 flex flex-wrap gap-3">
                {!isEpisodicType(content.type) ? (
                  <WatchButton href={`/watch/${content.slug}`} />
                ) : episodes[0] ? (
                  <WatchButton href={`/watch/${content.slug}/${episodes[0].slug}`} />
                ) : null}
                <button className="glass-button inline-flex items-center gap-2 rounded-full px-5 py-3 text-sm font-semibold text-white">
                  <Plus className="h-4 w-4" />
                  Тізімге қосу
                </button>
              </div>
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
        {content.dubber ? (
          <GlassPanel className="mb-10 p-5">
            <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
              <div className="flex min-w-0 items-center gap-4">
                {content.dubber.logoUrl ? (
                  <img
                    src={content.dubber.logoUrl}
                    alt={content.dubber.name}
                    className="h-14 w-14 rounded-2xl object-cover"
                  />
                ) : (
                  <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-[rgba(217,183,111,0.16)] text-[var(--accent)]">
                    <Radio className="h-6 w-6" />
                  </div>
                )}
                <div className="min-w-0">
                  <p className="text-xs font-semibold uppercase tracking-[0.24em] text-zinc-500">Даббер</p>
                  <h2 className="truncate text-xl font-semibold text-white">{content.dubber.name}</h2>
                  {content.dubber.description ? (
                    <p className="mt-1 line-clamp-2 text-sm leading-6 text-zinc-400">{content.dubber.description}</p>
                  ) : null}
                </div>
              </div>
              <div className="flex flex-wrap gap-2">
                {[
                  ["Telegram", content.dubber.telegramUrl],
                  ["VK", content.dubber.vkUrl],
                  ["Support", content.dubber.supportUrl],
                  ["Chat", content.dubber.chatUrl]
                ].map(([label, href]) =>
                  href ? (
                    <Link
                      key={label}
                      href={href}
                      className="glass-button rounded-full px-4 py-2 text-sm font-semibold text-white"
                    >
                      {label}
                    </Link>
                  ) : null
                )}
              </div>
            </div>
          </GlassPanel>
        ) : null}

        {isEpisodicType(content.type) ? (
          <section className="mb-14">
            <div className="mb-5">
              <h2 className="text-2xl font-semibold tracking-tight text-white sm:text-3xl">Episodes</h2>
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
                    <p className="text-sm font-semibold text-[var(--accent)]">
                      {episode.episodeNumber}-серия
                    </p>
                    <h3 className="mt-2 line-clamp-2 min-h-10 text-base font-semibold text-white">
                      {episode.title || `${episode.episodeNumber}-серия`}
                    </h3>
                    <p className="mt-3 inline-flex items-center gap-2 text-sm font-semibold text-zinc-300 transition group-hover:text-white">
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

        <MovieRow title="Ұқсас контент" movies={getTrendingMovies(movies).filter((item) => item.id !== content.id)} />
      </div>
    </main>
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
