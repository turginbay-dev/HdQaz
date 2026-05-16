"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { Check, Play } from "lucide-react";
import { formatEpisodeCount } from "@/features/content/format";
import type { Movie } from "@/types/movie";

type EpisodesSectionProps = {
  contentSlug: string;
  episodes: NonNullable<Movie["episodes"]>;
  selectedEpisodeId: string | null;
};

export function EpisodesSection({ contentSlug, episodes, selectedEpisodeId }: EpisodesSectionProps) {
  const [notice, setNotice] = useState<string | null>(null);
  const noticeTimerRef = useRef<number | null>(null);

  useEffect(() => {
    return () => window.clearTimeout(noticeTimerRef.current ?? undefined);
  }, []);

  function showCurrentEpisodeNotice() {
    window.clearTimeout(noticeTimerRef.current ?? undefined);
    setNotice("Сіз осы сериядасыз");
    noticeTimerRef.current = window.setTimeout(() => setNotice(null), 1800);
  }

  return (
    <section className="mb-14 mt-8 sm:mt-10">
      <div className="mb-5">
        <p className="text-xs font-bold uppercase tracking-[0.22em] text-[var(--accent)]">
          {formatEpisodeCount(episodes.length) || "Сериялар"}
        </p>
        <h2 className="mt-2 text-2xl font-bold tracking-[-0.024em] text-white sm:text-3xl">Сериялар</h2>
        <div className="mt-2 h-px w-24 bg-gradient-to-r from-[var(--accent)] to-transparent" />
      </div>

      {notice ? (
        <div className="glass mb-4 inline-flex min-h-10 items-center gap-2 rounded-full border-[rgba(217,183,111,0.34)] bg-[rgba(217,183,111,0.1)] px-4 text-sm font-semibold text-white">
          <Check className="h-4 w-4 text-[var(--accent)]" />
          {notice}
        </div>
      ) : null}

      {episodes.length > 0 ? (
        <div className="performance-rail hide-scrollbar -mx-4 flex snap-x snap-mandatory gap-3 overflow-x-auto overscroll-x-contain scroll-smooth px-4 pb-4 sm:-mx-6 sm:px-6 lg:mx-0 lg:grid lg:grid-cols-4 lg:overflow-visible lg:px-0 lg:pb-0">
          {episodes.map((episode) => {
            const active = episode.id === selectedEpisodeId;
            const className = active
              ? "glass group w-[76vw] max-w-[19rem] shrink-0 snap-start rounded-[24px] border-[rgba(217,183,111,0.45)] bg-[rgba(217,183,111,0.1)] p-4 text-left transition lg:w-auto lg:max-w-none"
              : "glass group w-[76vw] max-w-[19rem] shrink-0 snap-start rounded-[24px] p-4 transition hover:border-[rgba(217,183,111,0.35)] lg:w-auto lg:max-w-none";
            const content = (
              <>
                <div className="flex items-center justify-between gap-3">
                  <p className="text-sm font-bold tracking-[0.01em] text-[var(--accent)]">
                    {episode.episodeNumber}-серия
                  </p>
                  {active ? (
                    <span className="inline-flex h-6 w-6 shrink-0 items-center justify-center rounded-full border border-[rgba(217,183,111,0.34)] bg-[rgba(217,183,111,0.14)] text-[var(--accent)]">
                      <Check className="h-3.5 w-3.5" />
                    </span>
                  ) : null}
                </div>
                <h3 className="mt-2 line-clamp-2 min-h-11 break-words text-base font-bold leading-6 tracking-[-0.012em] text-white">
                  {episode.title || `${episode.episodeNumber}-серия`}
                </h3>
                <p className="mt-3 inline-flex items-center gap-2 text-sm font-semibold tracking-[0.01em] text-zinc-300 transition group-hover:text-white">
                  {active ? <Check className="h-4 w-4" /> : <Play className="h-4 w-4 fill-current" />}
                  {active ? "Қазір ашық" : "Ойнату"}
                </p>
              </>
            );

            return active ? (
              <button
                key={episode.id}
                className={className}
                type="button"
                aria-current="page"
                onClick={showCurrentEpisodeNotice}
              >
                {content}
              </button>
            ) : (
              <Link key={episode.id} href={episodePlayerHref(contentSlug, episode.slug)} className={className}>
                {content}
              </Link>
            );
          })}
        </div>
      ) : (
        <div className="glass-strong rounded-[30px] p-8 text-center text-lg font-semibold text-white">
          Сериялар жақында қосылады
        </div>
      )}
    </section>
  );
}

function episodePlayerHref(contentSlug: string, episodeSlug: string) {
  return `/${contentSlug}?episode=${encodeURIComponent(episodeSlug)}#player`;
}
