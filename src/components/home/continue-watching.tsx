import Link from "next/link";
import { Clock3, Play } from "lucide-react";
import { MovieImage } from "@/components/movie/movie-image";
import { Reveal } from "@/components/motion/reveal";
import type { ContinueWatchingItem } from "@/features/watch-history/types";

type ContinueWatchingProps = {
  isAuthenticated: boolean;
  items: ContinueWatchingItem[];
};

function formatRemaining(seconds: number | null) {
  if (!seconds || seconds <= 0) {
    return null;
  }

  const hours = Math.floor(seconds / 3600);
  const minutes = Math.max(1, Math.round((seconds % 3600) / 60));

  if (hours > 0) {
    return `${hours} сағ ${minutes} мин қалды`;
  }

  return `${minutes} мин қалды`;
}

function isSameDay(left: Date, right: Date) {
  return (
    left.getFullYear() === right.getFullYear() &&
    left.getMonth() === right.getMonth() &&
    left.getDate() === right.getDate()
  );
}

function formatLastWatched(value: string) {
  const date = new Date(value);
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const minute = 60 * 1000;
  const hour = 60 * 60 * 1000;
  const yesterday = new Date(now);
  yesterday.setDate(now.getDate() - 1);

  if (diffMs >= 0 && diffMs < hour) {
    const minutes = Math.max(1, Math.round(diffMs / minute));

    return `${minutes} минут бұрын`;
  }

  if (diffMs >= 0 && diffMs < 6 * hour) {
    const hours = Math.max(1, Math.round(diffMs / hour));

    return `${hours} сағат бұрын`;
  }

  if (isSameDay(date, now)) {
    return "Бүгін";
  }

  if (isSameDay(date, yesterday)) {
    return "Кеше";
  }

  return new Intl.DateTimeFormat("kk-KZ", {
    day: "numeric",
    month: "long"
  }).format(date);
}

export function ContinueWatching({ isAuthenticated, items }: ContinueWatchingProps) {
  if (!isAuthenticated) {
    return null;
  }

  return (
    <Reveal>
      <section className="content-rail-section">
        <div className="mb-5 flex items-end justify-between gap-4">
          <div>
            <p className="text-xs font-bold uppercase tracking-[0.24em] text-[var(--accent)]">
              Көру тарихы
            </p>
            <h2 className="mt-2 text-2xl font-bold tracking-[-0.024em] text-white sm:text-4xl">
              Жалғастырып көру
            </h2>
          </div>
          <Link href="/catalog" className="text-sm font-semibold tracking-[0.01em] text-zinc-400 transition hover:text-white">
            Каталог
          </Link>
        </div>

        {items.length > 0 ? (
          <div className="cinema-mask performance-rail hide-scrollbar -mx-4 flex snap-x snap-mandatory gap-4 overflow-x-auto overscroll-x-contain scroll-smooth px-4 pb-6 pt-1 sm:-mx-6 sm:px-6 lg:-mx-8 lg:px-8">
            {items.map((item, index) => {
              const remaining = formatRemaining(item.remainingSeconds);

              return (
                <Link
                  key={item.id}
                  href={`/${item.movie.slug}#player`}
                  className="continue-card group relative w-[82vw] shrink-0 snap-start overflow-hidden rounded-[24px] border border-white/10 bg-white/[0.045] p-3 shadow-[0_22px_72px_rgba(0,0,0,0.28)] transition duration-500 hover:-translate-y-1 hover:border-white/20 hover:bg-white/[0.075] sm:w-[22rem] sm:rounded-[28px] lg:w-[21rem]"
                >
                  <div className="movie-image-frame relative aspect-video overflow-hidden rounded-[22px]">
                    <MovieImage
                      src={item.movie.backdropUrl}
                      alt={item.movie.title}
                      fallback="backdrop"
                      fill
                      loading={index < 8 ? "eager" : undefined}
                      fetchPriority={index < 4 ? "low" : undefined}
                      sizes="(max-width: 640px) 80vw, 368px"
                      className="continue-card-image object-cover transition duration-700 group-hover:scale-105"
                    />
                    <div className="absolute inset-0 bg-gradient-to-t from-black/[0.9] via-black/20 to-transparent" />
                    <span className="absolute bottom-3 left-3 flex h-11 w-11 items-center justify-center rounded-full bg-white text-black shadow-[0_12px_40px_rgba(255,255,255,0.22)]">
                      <Play className="h-4 w-4 fill-current" />
                    </span>
                    <span className="glass absolute right-3 top-3 rounded-full px-3 py-1 text-xs font-bold tracking-[0.01em] text-white">
                      {item.progressPercent}%
                    </span>
                  </div>

                  <div className="px-1 pt-3">
                    <div className="flex flex-col gap-3 min-[390px]:flex-row min-[390px]:items-start min-[390px]:justify-between">
                      <div className="min-w-0">
                        <h3 className="truncate text-base font-bold tracking-[-0.014em] text-white">{item.movie.title}</h3>
                        <p className="mt-1 flex items-center gap-1.5 text-xs font-semibold tracking-[0.006em] text-zinc-500">
                          <Clock3 className="h-3.5 w-3.5 text-[var(--accent)]" />
                          {formatLastWatched(item.lastWatchedAt)}
                          {remaining ? ` · ${remaining}` : ""}
                        </p>
                      </div>
                      <span className="shrink-0 rounded-full border border-[rgba(217,183,111,0.28)] bg-[rgba(217,183,111,0.12)] px-3 py-1 text-xs font-bold text-[var(--accent)]">
                        Жалғастыру
                      </span>
                    </div>
                    <div className="mt-3 h-1.5 overflow-hidden rounded-full bg-white/10">
                      <div
                        className="h-full rounded-full bg-gradient-to-r from-[var(--accent)] to-[var(--accent-strong)]"
                        style={{ width: `${item.progressPercent}%` }}
                      />
                    </div>
                  </div>
                </Link>
              );
            })}
          </div>
        ) : (
          <div className="rounded-[28px] border border-white/10 bg-white/[0.045] px-5 py-8 text-center shadow-[0_24px_90px_rgba(0,0,0,0.28)]">
            <p className="text-sm font-semibold text-zinc-300">Көре бастаған контент осында сақталады</p>
            <Link
              href="/catalog"
              className="glass-button mt-4 inline-flex min-h-11 items-center justify-center rounded-full px-4 text-sm font-bold text-white"
            >
              Каталогқа өту
            </Link>
          </div>
        )}
      </section>
    </Reveal>
  );
}
