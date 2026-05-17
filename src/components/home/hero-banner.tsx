"use client";

import { memo, useMemo, useState } from "react";
import type { ReactNode } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { ChevronLeft, ChevronRight, Info } from "lucide-react";
import { LogoMark } from "@/components/layout/site-logo";
import { MovieBadge } from "@/components/movie/movie-badge";
import { MovieImage } from "@/components/movie/movie-image";
import { PremiumButton } from "@/components/ui/premium-button";
import { WatchButton } from "@/components/ui/watch-button";
import { contentStatusLabels, contentTypeLabels } from "@/features/content/format";
import { cn } from "@/lib/cn";
import type { Movie } from "@/types/movie";

type HeroBannerProps = {
  movies: Movie[];
};

const HERO_BACKDROP_SIZES = "(max-width: 640px) 100vw, (max-width: 1024px) 100vw, 100vw";
const HERO_POSTER_SIZES = "(max-width: 1023px) 1px, (max-width: 1279px) 250px, 280px";
const HERO_BLUR_DATA_URL =
  "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 16 9'%3E%3Cdefs%3E%3ClinearGradient id='a' x1='0' x2='1' y1='0' y2='1'%3E%3Cstop stop-color='%23030305'/%3E%3Cstop offset='.52' stop-color='%23110d0b'/%3E%3Cstop offset='1' stop-color='%23070812'/%3E%3C/linearGradient%3E%3CradialGradient id='b' cx='.72' cy='.22' r='.62'%3E%3Cstop stop-color='%23332416' stop-opacity='.82'/%3E%3Cstop offset='1' stop-color='%23030305' stop-opacity='0'/%3E%3C/radialGradient%3E%3C/defs%3E%3Crect width='16' height='9' fill='url(%23a)'/%3E%3Crect width='16' height='9' fill='url(%23b)'/%3E%3C/svg%3E";

const dust = Array.from({ length: 5 }, (_, index) => ({
  id: index,
  left: `${8 + ((index * 19) % 84)}%`,
  top: `${16 + ((index * 23) % 58)}%`,
  width: 18 + (index % 3) * 12
}));

export function HeroBanner({ movies }: HeroBannerProps) {
  const slides = useMemo(() => movies.filter(Boolean), [movies]);
  const [activeIndex, setActiveIndex] = useState(0);
  const movie = slides[activeIndex] ?? slides[0];

  if (!movie) {
    return null;
  }

  const typeLabel = movie.type ? contentTypeLabels[movie.type] : "Фильм";
  const statusLabel = movie.status ? contentStatusLabels[movie.status] : movie.isNewRelease ? "Жаңа" : "Аяқталған";
  const comment = movie.heroComment?.trim();
  const hasComment = Boolean(comment);
  const canNavigate = slides.length > 1;

  function goToSlide(direction: -1 | 1) {
    setActiveIndex((current) => (current + direction + slides.length) % slides.length);
  }

  return (
    <section className="hero-vignette relative overflow-hidden">
      <div className="absolute inset-0 scale-[1.05] bg-[#030305]">
        <AnimatePresence initial={false}>
          <motion.div
            key={movie.id}
            className="absolute inset-0"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.48, ease: [0.22, 1, 0.36, 1] }}
          >
            <HeroBackdrop movie={movie} />
          </motion.div>
        </AnimatePresence>
      </div>

      <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_68%_30%,rgba(255,180,92,0.16),transparent_32%),radial-gradient(ellipse_at_24%_18%,rgba(143,183,255,0.14),transparent_34%)]" />
      <div className="absolute inset-0 bg-gradient-to-r from-black via-black/[0.68] to-black/[0.18]" />
      <div className="absolute inset-0 bg-gradient-to-t from-[var(--background)] via-black/[0.18] to-black/[0.38]" />
      <div className="cinematic-fog" />
      <div className="absolute inset-x-0 bottom-0 h-44 bg-gradient-to-t from-[var(--background)] to-transparent" />

      {dust.map((item) => (
        <span
          key={item.id}
          className="absolute h-px rounded-full bg-white/[0.16]"
          style={{ left: item.left, top: item.top, width: item.width }}
        />
      ))}

      {canNavigate ? (
        <div className="pointer-events-none absolute inset-x-2 top-1/2 z-20 flex -translate-y-1/2 justify-between sm:inset-x-5">
          <HeroArrow label="Алдыңғы слайд" onClick={() => goToSlide(-1)}>
            <ChevronLeft className="h-5 w-5" />
          </HeroArrow>
          <HeroArrow label="Келесі слайд" onClick={() => goToSlide(1)}>
            <ChevronRight className="h-5 w-5" />
          </HeroArrow>
        </div>
      ) : null}

      <div className="hero-layout relative mx-auto grid w-full max-w-7xl items-end gap-8 px-4 pb-14 pt-24 sm:px-6 sm:pb-16 sm:pt-28 lg:grid-cols-[minmax(0,1fr)_280px] lg:px-8 lg:pb-[4.5rem] lg:pt-[7.5rem] xl:grid-cols-[minmax(0,1fr)_320px]">
        <AnimatePresence initial={false} mode="wait">
          <motion.div
            key={`content-${movie.id}`}
            className="max-w-4xl"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            transition={{ duration: 0.46, ease: [0.22, 1, 0.36, 1] }}
          >
            <div className="mb-4 inline-flex items-center gap-2 rounded-full border border-white/[0.14] bg-white/10 px-3.5 py-1.5 text-[0.68rem] font-bold uppercase tracking-[0.18em] text-zinc-200 backdrop-blur-xl">
              <LogoMark className="h-6 w-10 p-0.5" sizes="40px" />
              HdQaz таңдауы
            </div>

            <div className="mb-4 flex flex-wrap gap-2">
              <MovieBadge label={typeLabel} />
              <MovieBadge label={statusLabel} />
              {movie.badges.map((badge) => (
                <MovieBadge key={badge} label={badge === "Қазақша субтитрмен" ? "Қазақша субтитр" : badge} />
              ))}
              {movie.dubber?.name ? <MovieBadge label={movie.dubber.name} /> : null}
              <MovieBadge label="1080p" />
            </div>

            <h1
              className={cn(
                "type-cinematic max-w-4xl break-words leading-[0.94] tracking-[var(--tracking-cinematic)] text-white",
                hasComment
                  ? "[font-size:clamp(2.1rem,8.4vw,3.8rem)] sm:[font-size:clamp(2.6rem,5.9vw,5rem)]"
                  : "[font-size:clamp(2.35rem,9vw,4.35rem)] sm:[font-size:clamp(2.9rem,6.5vw,5.8rem)]"
              )}
            >
              {movie.title}
            </h1>

            {comment ? (
              <p className="mt-4 max-w-2xl text-sm font-semibold leading-6 tracking-[0.006em] text-zinc-200 sm:text-base sm:leading-7">
                {comment}
              </p>
            ) : null}

            <div className="mt-6 flex flex-wrap items-center gap-3">
              <WatchButton href={`/${movie.slug}#player`} className="min-h-10 w-full min-w-0 px-4 sm:w-auto sm:min-h-11 sm:min-w-32" />
              <PremiumButton href={`/${movie.slug}`} variant="glass" className="min-h-10 w-full min-w-0 px-4 sm:w-auto sm:min-h-11 sm:min-w-32">
                <Info className="h-4 w-4" />
                Толығырақ
              </PremiumButton>
            </div>
          </motion.div>
        </AnimatePresence>

        <AnimatePresence initial={false} mode="wait">
          <motion.div
            key={`poster-${movie.id}`}
            className="relative mx-auto hidden w-full max-w-[250px] pb-4 lg:block xl:max-w-[280px]"
            initial={{ opacity: 0, x: 28 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: 18 }}
            transition={{ duration: 0.48, ease: [0.22, 1, 0.36, 1] }}
          >
            <div className="absolute -inset-8 rounded-full bg-[rgba(217,183,111,0.16)] blur-3xl" />
            <div className="poster-reflection relative aspect-[2/3] overflow-hidden rounded-[24px] border border-white/[0.16] bg-white/[0.06] p-1.5 shadow-[0_28px_90px_rgba(0,0,0,0.62)] backdrop-blur-xl">
              <div className="relative h-full overflow-hidden rounded-[19px]">
                <MovieImage
                  src={movie.posterUrl}
                  alt={movie.title}
                  fallback="poster"
                  fill
                  sizes={HERO_POSTER_SIZES}
                  placeholder="blur"
                  blurDataURL={HERO_BLUR_DATA_URL}
                  className="object-cover"
                />
                <div className="absolute inset-0 bg-gradient-to-t from-black/[0.32] via-transparent to-white/[0.08]" />
              </div>
            </div>
          </motion.div>
        </AnimatePresence>
      </div>
    </section>
  );
}

const HeroBackdrop = memo(function HeroBackdrop({ movie }: { movie: Movie }) {
  const [imageLoaded, setImageLoaded] = useState(false);

  return (
    <div className="hero-backdrop-fallback absolute inset-0">
      <MovieImage
        src={movie.backdropUrl}
        alt=""
        fallback="backdrop"
        fill
        priority={true}
        fetchPriority="high"
        sizes={HERO_BACKDROP_SIZES}
        placeholder="blur"
        blurDataURL={HERO_BLUR_DATA_URL}
        onLoadingComplete={() => setImageLoaded(true)}
        className={cn("hero-backdrop-image object-cover", imageLoaded && "is-loaded")}
      />
    </div>
  );
});

function HeroArrow({
  children,
  label,
  onClick
}: {
  children: ReactNode;
  label: string;
  onClick: () => void;
}) {
  return (
    <button
      className="glass-button pointer-events-auto flex h-11 w-11 items-center justify-center rounded-full text-white shadow-[0_16px_48px_rgba(0,0,0,0.42)] transition hover:scale-105 sm:h-12 sm:w-12"
      aria-label={label}
      onClick={onClick}
      type="button"
    >
      {children}
    </button>
  );
}
