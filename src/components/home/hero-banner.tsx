"use client";

import { useRef } from "react";
import { motion, useScroll, useTransform } from "framer-motion";
import { Info } from "lucide-react";
import { LogoMark } from "@/components/layout/site-logo";
import { MovieBadge } from "@/components/movie/movie-badge";
import { MovieImage } from "@/components/movie/movie-image";
import { PremiumButton } from "@/components/ui/premium-button";
import { WatchButton } from "@/components/ui/watch-button";
import { contentStatusLabels, contentTypeLabels } from "@/features/content/format";
import type { Movie } from "@/types/movie";

type HeroBannerProps = {
  movie: Movie;
};

const dust = Array.from({ length: 8 }, (_, index) => ({
  id: index,
  left: `${6 + ((index * 17) % 88)}%`,
  top: `${14 + ((index * 23) % 66)}%`,
  delay: index * 0.16,
  width: 18 + (index % 4) * 10
}));

export function HeroBanner({ movie }: HeroBannerProps) {
  const typeLabel = movie.type ? contentTypeLabels[movie.type] : "Movie";
  const statusLabel = movie.status ? contentStatusLabels[movie.status] : movie.isNewRelease ? "Жаңа" : "Аяқталған";
  const ref = useRef<HTMLElement | null>(null);
  const { scrollYProgress } = useScroll({
    target: ref,
    offset: ["start start", "end start"]
  });
  const imageY = useTransform(scrollYProgress, [0, 1], ["0%", "13%"]);
  const contentY = useTransform(scrollYProgress, [0, 1], ["0%", "16%"]);
  const opacity = useTransform(scrollYProgress, [0, 0.74], [1, 0]);

  return (
    <section ref={ref} className="hero-vignette relative min-h-[100svh] overflow-hidden">
      <motion.div
        className="absolute inset-0 scale-[1.08]"
        style={{ y: imageY }}
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

      <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_68%_30%,rgba(255,180,92,0.2),transparent_32%),radial-gradient(ellipse_at_24%_18%,rgba(143,183,255,0.18),transparent_34%)]" />
      <div className="absolute inset-0 bg-gradient-to-r from-black via-black/[0.66] to-black/[0.18]" />
      <div className="absolute inset-0 bg-gradient-to-t from-[var(--background)] via-black/[0.2] to-black/[0.42]" />
      <div className="cinematic-fog" />
      <div className="absolute inset-x-0 bottom-0 h-52 bg-gradient-to-t from-[var(--background)] to-transparent" />

      {dust.map((item) => (
        <span
          key={item.id}
          className="absolute h-px rounded-full bg-white/[0.18]"
          style={{ left: item.left, top: item.top, width: item.width }}
        />
      ))}

      <motion.div
        className="relative mx-auto grid min-h-[100svh] w-full max-w-7xl items-end gap-10 px-4 pb-24 pt-36 sm:px-6 lg:grid-cols-[minmax(0,1fr)_380px] lg:px-8 lg:pb-28 lg:pt-40 xl:grid-cols-[minmax(0,1fr)_440px]"
        style={{ y: contentY, opacity }}
      >
        <div className="max-w-4xl">
          <motion.div
            className="mb-5 inline-flex items-center gap-2 rounded-full border border-white/[0.14] bg-white/10 px-4 py-2 text-[0.7rem] font-bold uppercase tracking-[0.2em] text-zinc-200 backdrop-blur-2xl"
            initial={{ opacity: 0, y: 18 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.7 }}
          >
            <LogoMark className="h-6 w-6 p-0.5" sizes="24px" />
            HdQaz Original Selection
          </motion.div>

          <motion.div
            className="mb-5 flex flex-wrap gap-2"
            initial={{ opacity: 0, y: 18 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.7, delay: 0.08 }}
          >
            <MovieBadge label={typeLabel} />
            <MovieBadge label={statusLabel} />
            {movie.dubber?.name ? <MovieBadge label={movie.dubber.name} /> : null}
            <MovieBadge label="1080p" />
          </motion.div>

          <motion.h1
            className="max-w-4xl font-cinematic leading-[0.92] tracking-[var(--tracking-cinematic)] text-white [font-size:clamp(3.4rem,9.4vw,8.4rem)]"
            initial={{ opacity: 0, y: 24, filter: "blur(12px)" }}
            animate={{ opacity: 1, y: 0, filter: "blur(0px)" }}
            transition={{ duration: 0.9, delay: 0.12, ease: [0.22, 1, 0.36, 1] }}
          >
            {movie.title}
          </motion.h1>

          <motion.p
            className="mt-6 max-w-2xl text-base font-medium leading-7 tracking-[0.006em] text-zinc-200 sm:text-lg sm:leading-8"
            initial={{ opacity: 0, y: 18 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.7, delay: 0.24 }}
          >
            {movie.description}
          </motion.p>

          <motion.div
            className="mt-8 flex flex-wrap items-center gap-3"
            initial={{ opacity: 0, y: 18 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.7, delay: 0.34 }}
          >
            <WatchButton href={`/${movie.slug}#player`} className="min-w-40" />
            <PremiumButton href={`/${movie.slug}`} variant="glass" className="min-w-40">
              <Info className="h-4 w-4" />
              Толығырақ
            </PremiumButton>
          </motion.div>
        </div>

        <motion.div
          className="relative mx-auto hidden w-full max-w-[360px] pb-8 lg:block"
          initial={{ opacity: 0, x: 40, filter: "blur(14px)" }}
          animate={{ opacity: 1, x: 0, filter: "blur(0px)" }}
          transition={{ duration: 0.9, delay: 0.25, ease: [0.22, 1, 0.36, 1] }}
        >
          <div className="absolute -inset-10 rounded-full bg-[rgba(217,183,111,0.2)] blur-3xl" />
          <div className="poster-reflection relative aspect-[2/3] overflow-hidden rounded-[34px] border border-white/[0.16] bg-white/[0.06] p-2 shadow-[0_42px_150px_rgba(0,0,0,0.72)] backdrop-blur-2xl">
            <div className="relative h-full overflow-hidden rounded-[27px]">
              <MovieImage
                src={movie.posterUrl}
                alt={movie.title}
                fallback="poster"
                fill
                priority
                sizes="420px"
                className="object-cover"
              />
              <div className="absolute inset-0 bg-gradient-to-t from-black/[0.36] via-transparent to-white/[0.08]" />
            </div>
          </div>
        </motion.div>
      </motion.div>

    </section>
  );
}
