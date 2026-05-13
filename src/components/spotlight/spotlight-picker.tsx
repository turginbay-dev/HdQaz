"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import {
  AnimatePresence,
  motion,
  useAnimationControls
} from "framer-motion";
import { Shuffle, Sparkles } from "lucide-react";
import { MovieBadge } from "@/components/movie/movie-badge";
import { MovieImage } from "@/components/movie/movie-image";
import { PremiumButton } from "@/components/ui/premium-button";
import { WatchButton } from "@/components/ui/watch-button";
import { contentStatusLabels, contentTypeLabels, formatEpisodeCount, isEpisodicContent } from "@/features/content/format";
import type { Movie } from "@/types/movie";

type SpotlightPickerProps = {
  movies: Movie[];
};

const LOOP_COUNT = 5;
const CENTER_LOOP = Math.floor(LOOP_COUNT / 2);

export function SpotlightPicker({ movies }: SpotlightPickerProps) {
  const [selectedIndex, setSelectedIndex] = useState(0);
  const [rolling, setRolling] = useState(false);
  const viewportRef = useRef<HTMLDivElement | null>(null);
  const trackRef = useRef<HTMLDivElement | null>(null);
  const firstPosterRef = useRef<HTMLDivElement | null>(null);
  const controls = useAnimationControls();
  const [layout, setLayout] = useState({
    cardWidth: 160,
    gap: 20,
    paddingLeft: 28,
    viewportWidth: 0
  });
  const selectedMovie = movies[selectedIndex];
  const loopedMovies = useMemo(
    () => Array.from({ length: LOOP_COUNT }, () => movies).flat(),
    [movies]
  );
  const activeTrackIndex = CENTER_LOOP * movies.length + selectedIndex;

  const getTrackX = useCallback(
    (trackIndex: number) =>
      layout.viewportWidth / 2 -
      layout.paddingLeft -
      trackIndex * (layout.cardWidth + layout.gap) -
      layout.cardWidth / 2,
    [layout]
  );

  useEffect(() => {
    setSelectedIndex((current) => {
      if (movies.length === 0) {
        return 0;
      }

      return Math.min(current, movies.length - 1);
    });
  }, [movies.length]);

  useEffect(() => {
    const viewport = viewportRef.current;
    const track = trackRef.current;
    const firstPoster = firstPosterRef.current;

    if (!viewport || !track || !firstPoster) {
      return;
    }

    const updateLayout = () => {
      const trackStyles = window.getComputedStyle(track);

      setLayout({
        cardWidth: firstPoster.offsetWidth,
        gap: Number.parseFloat(trackStyles.columnGap) || 20,
        paddingLeft: Number.parseFloat(trackStyles.paddingLeft) || 28,
        viewportWidth: viewport.clientWidth
      });
    };

    updateLayout();

    const resizeObserver = new ResizeObserver(updateLayout);
    resizeObserver.observe(viewport);
    resizeObserver.observe(firstPoster);
    window.addEventListener("resize", updateLayout);

    return () => {
      resizeObserver.disconnect();
      window.removeEventListener("resize", updateLayout);
    };
  }, [movies.length]);

  useEffect(() => {
    if (movies.length === 0 || rolling) {
      return;
    }

    void controls.start({
      x: getTrackX(activeTrackIndex),
      transition: { type: "spring", stiffness: 120, damping: 24 }
    });
  }, [activeTrackIndex, controls, getTrackX, movies.length, rolling]);

  async function pickRandomMovie() {
    if (rolling || movies.length === 0) {
      return;
    }

    const randomStep =
      movies.length > 1 ? Math.floor(Math.random() * (movies.length - 1)) + 1 : 0;
    const nextIndex = (selectedIndex + randomStep) % movies.length;
    const targetTrackIndex = (CENTER_LOOP + 1) * movies.length + nextIndex;

    setRolling(true);

    await controls.start({
      x: getTrackX(targetTrackIndex),
      transition: { duration: 1.1, ease: [0.16, 1, 0.3, 1] }
    });

    controls.set({ x: getTrackX(CENTER_LOOP * movies.length + nextIndex) });
    setSelectedIndex(nextIndex);
    setRolling(false);
  }

  if (!selectedMovie) {
    return null;
  }

  const selectedTypeLabel = selectedMovie.type ? contentTypeLabels[selectedMovie.type] : "Movie";
  const selectedStatusLabel = selectedMovie.status ? contentStatusLabels[selectedMovie.status] : "Аяқталған";
  const selectedIsEpisodic = isEpisodicContent(selectedMovie);
  const selectedRuntime = selectedIsEpisodic
    ? formatEpisodeCount(selectedMovie.episodeCount) || "Сериялар"
    : selectedMovie.runtime;
  const selectedFirstEpisode = selectedMovie.episodes?.[0];

  return (
    <section className="relative overflow-hidden rounded-[34px] border border-white/10 bg-[linear-gradient(140deg,rgba(255,255,255,0.08),rgba(255,255,255,0.025))] px-4 py-5 shadow-[0_30px_120px_rgba(0,0,0,0.44)] backdrop-blur-3xl sm:px-6 sm:py-7 lg:px-8">
      <AnimatePresence mode="wait">
        <motion.div
          key={selectedMovie.backdropUrl}
          className="absolute inset-0"
          initial={{ opacity: 0, scale: 1.04 }}
          animate={{ opacity: 0.24, scale: 1 }}
          exit={{ opacity: 0, scale: 1.02 }}
          transition={{ duration: 0.55, ease: [0.22, 1, 0.36, 1] }}
        >
          <MovieImage
            src={selectedMovie.backdropUrl}
            alt=""
            fallback="backdrop"
            fill
            sizes="100vw"
            className="object-cover"
          />
        </motion.div>
      </AnimatePresence>
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_at_22%_10%,rgba(217,183,111,0.18),transparent_36%),radial-gradient(ellipse_at_88%_12%,rgba(143,183,255,0.14),transparent_32%)]" />
      <div className="pointer-events-none absolute inset-0 bg-gradient-to-r from-black/80 via-black/50 to-black/70" />
      <div className="pointer-events-none absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-white/30 to-transparent" />

      <div className="relative grid gap-7 lg:grid-cols-[minmax(0,1fr)_360px] lg:items-center">
        <div className="min-w-0">
          <div className="mb-5 flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
            <div>
              <p className="flex items-center gap-2 text-xs font-bold uppercase tracking-[0.24em] text-[var(--accent)]">
                <Sparkles className="h-3.5 w-3.5" />
                Spotlight
              </p>
              <AnimatePresence mode="wait">
                <motion.h2
                  key={selectedMovie.id}
                  className="mt-2 max-w-2xl text-3xl font-bold tracking-[-0.026em] text-white sm:text-5xl"
                  initial={{ opacity: 0, y: 14, filter: "blur(8px)" }}
                  animate={{ opacity: 1, y: 0, filter: "blur(0px)" }}
                  exit={{ opacity: 0, y: -10, filter: "blur(8px)" }}
                  transition={{ duration: 0.35 }}
                >
                  {selectedMovie.title} атмосферасы
                </motion.h2>
              </AnimatePresence>
            </div>
            <PremiumButton onClick={pickRandomMovie} variant="glass" className="w-full sm:w-auto">
              <Shuffle className="h-4 w-4" />
              Random Atmosphere
            </PremiumButton>
          </div>

          <div
            ref={viewportRef}
            className="cinema-mask relative h-[270px] overflow-hidden rounded-[30px] border border-white/10 bg-black/[0.28] sm:h-[330px]"
          >
            <div className="pointer-events-none absolute inset-y-0 left-1/2 z-20 w-[2px] -translate-x-1/2 bg-[var(--accent)] shadow-[0_0_46px_rgba(217,183,111,0.95)]" />
            <div className="pointer-events-none absolute left-1/2 top-1/2 z-10 h-52 w-40 -translate-x-1/2 -translate-y-1/2 rounded-[28px] border border-[rgba(217,183,111,0.45)] shadow-[0_0_80px_rgba(217,183,111,0.24)]" />

            <motion.div
              ref={trackRef}
              className="flex h-full items-center gap-5 px-7"
              initial={false}
              animate={controls}
            >
              {loopedMovies.map((movie, index) => {
                const active = index === activeTrackIndex && !rolling;

                return (
                  <motion.div
                    ref={index === 0 ? firstPosterRef : undefined}
                    key={`${movie.id}-${index}`}
                    className="poster-reflection relative h-60 w-40 shrink-0 overflow-hidden rounded-[24px] border border-white/10 bg-white/5 shadow-2xl sm:h-72"
                    animate={{
                      scale: active ? 1.08 : 0.9,
                      opacity: active ? 1 : 0.48,
                      y: active ? -8 : 8
                    }}
                    transition={{ type: "spring", stiffness: 220, damping: 24 }}
                  >
                    <MovieImage
                      src={movie.posterUrl}
                      alt={movie.title}
                      fallback="poster"
                      fill
                      sizes="180px"
                      className="object-cover"
                    />
                    <span className="absolute inset-0 bg-gradient-to-t from-black/60 to-transparent" />
                  </motion.div>
                );
              })}
            </motion.div>
          </div>
        </div>

        <motion.div
          className="relative rounded-[30px] border border-white/[0.12] bg-black/[0.34] p-4 shadow-[0_24px_90px_rgba(0,0,0,0.44)] backdrop-blur-3xl"
        >
          <AnimatePresence mode="wait">
            <motion.div
              key={selectedMovie.id}
              initial={{ opacity: 0, y: 16, filter: "blur(8px)" }}
              animate={{ opacity: 1, y: 0, filter: "blur(0px)" }}
              exit={{ opacity: 0, y: -12, filter: "blur(8px)" }}
              transition={{ duration: 0.32 }}
            >
              <div className="grid grid-cols-[112px_1fr] gap-4">
                <div className="relative aspect-[2/3] overflow-hidden rounded-[22px] shadow-[0_20px_60px_rgba(0,0,0,0.5)]">
                  <MovieImage
                    src={selectedMovie.posterUrl}
                    alt={selectedMovie.title}
                    fallback="poster"
                    fill
                    sizes="120px"
                    className="object-cover"
                  />
                </div>
                <div className="min-w-0">
                  <div className="mb-3 flex flex-wrap gap-1.5">
                    <MovieBadge label={selectedTypeLabel} />
                    <MovieBadge label={selectedStatusLabel} />
                  </div>
                  <h3 className="text-2xl font-bold tracking-[-0.02em] text-white">
                    {selectedMovie.title}
                  </h3>
                  <p className="mt-2 text-sm font-medium leading-6 tracking-[0.004em] text-zinc-400">
                    {selectedMovie.year} · {selectedRuntime} · {selectedMovie.dubber?.name ?? selectedStatusLabel}
                  </p>
                </div>
              </div>

              <p className="mt-4 line-clamp-3 text-sm font-medium leading-6 tracking-[0.004em] text-zinc-300">
                {selectedMovie.description}
              </p>

              <div className="mt-4 rounded-2xl border border-white/10 bg-white/[0.06] p-3">
                <p className="text-xs font-bold uppercase tracking-[0.2em] text-[var(--accent)]">
                  Atmosphere signal
                </p>
                <p className="mt-2 text-sm font-medium leading-6 tracking-[0.004em] text-zinc-300">
                  Жанр, дыбыстама және mood rhythm бойынша кешкі көруге лайық.
                </p>
              </div>

              <div className="mt-5 flex gap-2">
                <WatchButton
                  href={
                    selectedIsEpisodic && selectedFirstEpisode
                      ? `/watch/${selectedMovie.slug}/${selectedFirstEpisode.slug}`
                      : `/watch/${selectedMovie.slug}`
                  }
                  className="flex-1"
                />
                <Link
                  href={`/${selectedMovie.slug}`}
                  className="glass-button inline-flex min-h-12 items-center justify-center rounded-full px-4 text-sm font-semibold tracking-[0.01em] text-white"
                >
                  Detail
                </Link>
              </div>
            </motion.div>
          </AnimatePresence>
        </motion.div>
      </div>
    </section>
  );
}
