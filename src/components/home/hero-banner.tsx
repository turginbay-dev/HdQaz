"use client";

import { useMemo, useRef, useState } from "react";
import type { ReactNode } from "react";
import { AnimatePresence, motion, useScroll, useTransform } from "framer-motion";
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

const dust = Array.from({ length: 5 }, (_, index) => ({
  id: index,
  left: `${8 + ((index * 19) % 84)}%`,
  top: `${16 + ((index * 23) % 58)}%`,
  width: 18 + (index % 3) * 12
}));

export function HeroBanner({ movies }: HeroBannerProps) {
  const slides = useMemo(() => movies.filter(Boolean), [movies]);
  const [activeIndex, setActiveIndex] = useState(0);
  const ref = useRef<HTMLElement | null>(null);
  const { scrollYProgress } = useScroll({
    target: ref,
    offset: ["start start", "end start"]
  });
  const imageY = useTransform(scrollYProgress, [0, 1], ["0%", "8%"]);
  const contentY = useTransform(scrollYProgress, [0, 1], ["0%", "8%"]);
  const opacity = useTransform(scrollYProgress, [0, 0.82], [1, 0]);
  const movie = slides[activeIndex] ?? slides[0];

  if (!movie) {
    return null;
  }

  const typeLabel = movie.type ? contentTypeLabels[movie.type] : "Movie";
  const statusLabel = movie.status ? contentStatusLabels[movie.status] : movie.isNewRelease ? "Жаңа" : "Аяқталған";
  const comment = movie.heroComment?.trim();
  const hasComment = Boolean(comment);
  const canNavigate = slides.length > 1;

  function goToSlide(direction: -1 | 1) {
    setActiveIndex((current) => (current + direction + slides.length) % slides.length);
  }

  return (
    <section ref={ref} className="hero-vignette relative min-h-[78svh] overflow-hidden sm:min-h-[86svh]">
      <motion.div className="absolute inset-0 scale-[1.05]" style={{ y: imageY }}>
        <AnimatePresence mode="wait">
          <motion.div
            key={movie.id}
            className="absolute inset-0"
            initial={{ opacity: 0, scale: 1.035 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 1.02 }}
            transition={{ duration: 0.52, ease: [0.22, 1, 0.36, 1] }}
          >
            <MovieImage
              src={movie.backdropUrl}
              alt=""
              fallback="backdrop"
              fill
              priority
              sizes="100vw"
              className="object-cover"
            />
          </motion.div>
        </AnimatePresence>
      </motion.div>

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

      <motion.div
        className="relative mx-auto grid min-h-[78svh] w-full max-w-7xl items-end gap-8 px-4 pb-16 pt-28 sm:min-h-[86svh] sm:px-6 sm:pb-20 sm:pt-32 lg:grid-cols-[minmax(0,1fr)_320px] lg:px-8 lg:pb-24 lg:pt-36 xl:grid-cols-[minmax(0,1fr)_380px]"
        style={{ y: contentY, opacity }}
      >
        <AnimatePresence mode="wait">
          <motion.div
            key={`content-${movie.id}`}
            className="max-w-4xl"
            initial={{ opacity: 0, y: 20, filter: "blur(10px)" }}
            animate={{ opacity: 1, y: 0, filter: "blur(0px)" }}
            exit={{ opacity: 0, y: -10, filter: "blur(8px)" }}
            transition={{ duration: 0.46, ease: [0.22, 1, 0.36, 1] }}
          >
            <div className="mb-4 inline-flex items-center gap-2 rounded-full border border-white/[0.14] bg-white/10 px-3.5 py-1.5 text-[0.68rem] font-bold uppercase tracking-[0.18em] text-zinc-200 backdrop-blur-xl">
              <LogoMark className="h-6 w-10 p-0.5" sizes="40px" />
              HdQaz Selection
            </div>

            <div className="mb-4 flex flex-wrap gap-2">
              <MovieBadge label={typeLabel} />
              <MovieBadge label={statusLabel} />
              {movie.dubber?.name ? <MovieBadge label={movie.dubber.name} /> : null}
              <MovieBadge label="1080p" />
            </div>

            <h1
              className={cn(
                "max-w-4xl break-words font-cinematic leading-[0.94] tracking-[var(--tracking-cinematic)] text-white",
                hasComment
                  ? "[font-size:clamp(2.35rem,10vw,4.6rem)] sm:[font-size:clamp(3rem,7.5vw,6.4rem)]"
                  : "[font-size:clamp(2.8rem,12vw,5.4rem)] sm:[font-size:clamp(3.4rem,8.6vw,7.6rem)]"
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
              <WatchButton href={`/${movie.slug}#player`} className="min-h-11 w-full min-w-0 px-4 sm:w-auto sm:min-w-36 sm:min-h-12" />
              <PremiumButton href={`/${movie.slug}`} variant="glass" className="min-h-11 w-full min-w-0 px-4 sm:w-auto sm:min-w-36 sm:min-h-12">
                <Info className="h-4 w-4" />
                Толығырақ
              </PremiumButton>
            </div>
          </motion.div>
        </AnimatePresence>

        <AnimatePresence mode="wait">
          <motion.div
            key={`poster-${movie.id}`}
            className="relative mx-auto hidden w-full max-w-[310px] pb-5 lg:block"
            initial={{ opacity: 0, x: 28, filter: "blur(12px)" }}
            animate={{ opacity: 1, x: 0, filter: "blur(0px)" }}
            exit={{ opacity: 0, x: 18, filter: "blur(10px)" }}
            transition={{ duration: 0.48, ease: [0.22, 1, 0.36, 1] }}
          >
            <div className="absolute -inset-8 rounded-full bg-[rgba(217,183,111,0.16)] blur-3xl" />
            <div className="poster-reflection relative aspect-[2/3] overflow-hidden rounded-[28px] border border-white/[0.16] bg-white/[0.06] p-2 shadow-[0_34px_110px_rgba(0,0,0,0.66)] backdrop-blur-xl">
              <div className="relative h-full overflow-hidden rounded-[21px]">
                <MovieImage
                  src={movie.posterUrl}
                  alt={movie.title}
                  fallback="poster"
                  fill
                  priority
                  sizes="360px"
                  className="object-cover"
                />
                <div className="absolute inset-0 bg-gradient-to-t from-black/[0.32] via-transparent to-white/[0.08]" />
              </div>
            </div>
          </motion.div>
        </AnimatePresence>
      </motion.div>
    </section>
  );
}

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
