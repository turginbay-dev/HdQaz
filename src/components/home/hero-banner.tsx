"use client";

import { useRef } from "react";
import { motion, useMotionValue, useScroll, useTransform } from "framer-motion";
import { Info, Play } from "lucide-react";
import { LogoMark } from "@/components/layout/site-logo";
import { MovieBadge } from "@/components/movie/movie-badge";
import { MovieImage } from "@/components/movie/movie-image";
import { PremiumButton } from "@/components/ui/premium-button";
import { formatMovieLanguages } from "@/lib/movie-taxonomy";
import type { Movie } from "@/types/movie";

type HeroBannerProps = {
  movie: Movie;
};

const dust = Array.from({ length: 22 }, (_, index) => ({
  id: index,
  left: `${6 + ((index * 17) % 88)}%`,
  top: `${14 + ((index * 23) % 66)}%`,
  delay: index * 0.16,
  width: 18 + (index % 4) * 10
}));

export function HeroBanner({ movie }: HeroBannerProps) {
  const ref = useRef<HTMLElement | null>(null);
  const pointerX = useMotionValue(0.5);
  const pointerY = useMotionValue(0.5);
  const bgX = useTransform(pointerX, [0, 1], ["-1.5%", "1.5%"]);
  const bgY = useTransform(pointerY, [0, 1], ["-1%", "1%"]);
  const posterRotateY = useTransform(pointerX, [0, 1], [-8, 8]);
  const posterRotateX = useTransform(pointerY, [0, 1], [6, -6]);
  const posterY = useTransform(pointerY, [0, 1], [-10, 10]);

  const { scrollYProgress } = useScroll({
    target: ref,
    offset: ["start start", "end start"]
  });
  const imageY = useTransform(scrollYProgress, [0, 1], ["0%", "13%"]);
  const contentY = useTransform(scrollYProgress, [0, 1], ["0%", "16%"]);
  const opacity = useTransform(scrollYProgress, [0, 0.74], [1, 0]);

  return (
    <section
      ref={ref}
      className="hero-vignette relative min-h-[100svh] overflow-hidden"
      onMouseMove={(event) => {
        const rect = event.currentTarget.getBoundingClientRect();
        pointerX.set((event.clientX - rect.left) / rect.width);
        pointerY.set((event.clientY - rect.top) / rect.height);
      }}
    >
      <motion.div
        className="absolute inset-0 scale-[1.08]"
        style={{ x: bgX, y: imageY }}
        animate={{ scale: [1.08, 1.115, 1.08] }}
        transition={{ duration: 18, repeat: Infinity, ease: "easeInOut" }}
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

      <motion.div
        className="absolute inset-0 bg-[radial-gradient(ellipse_at_68%_30%,rgba(255,180,92,0.2),transparent_32%),radial-gradient(ellipse_at_24%_18%,rgba(143,183,255,0.18),transparent_34%)]"
        style={{ y: bgY }}
      />
      <div className="absolute inset-0 bg-gradient-to-r from-black via-black/[0.66] to-black/[0.18]" />
      <div className="absolute inset-0 bg-gradient-to-t from-[var(--background)] via-black/[0.2] to-black/[0.42]" />
      <div className="cinematic-fog" />
      <div className="absolute inset-x-0 bottom-0 h-52 bg-gradient-to-t from-[var(--background)] to-transparent" />

      {dust.map((item) => (
        <motion.span
          key={item.id}
          className="absolute h-px rounded-full bg-white/[0.18]"
          style={{ left: item.left, top: item.top, width: item.width }}
          animate={{ opacity: [0.04, 0.32, 0.04], x: [0, 22, 0], y: [0, -8, 0] }}
          transition={{ duration: 6.2, delay: item.delay, repeat: Infinity, ease: "easeInOut" }}
        />
      ))}

      <motion.div
        className="relative mx-auto grid min-h-[100svh] w-full max-w-7xl items-end gap-10 px-4 pb-24 pt-36 sm:px-6 lg:grid-cols-[minmax(0,1fr)_380px] lg:px-8 lg:pb-28 lg:pt-40 xl:grid-cols-[minmax(0,1fr)_440px]"
        style={{ y: contentY, opacity }}
      >
        <div className="max-w-4xl">
          <motion.div
            className="mb-5 inline-flex items-center gap-2 rounded-full border border-white/[0.14] bg-white/10 px-4 py-2 text-xs font-semibold uppercase tracking-[0.24em] text-zinc-200 backdrop-blur-2xl"
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
            {movie.badges.map((badge) => (
              <MovieBadge key={badge} label={badge} />
            ))}
            {movie.isNewRelease && <MovieBadge label="Жаңа" />}
            <MovieBadge label="1080p" />
          </motion.div>

          <motion.h1
            className="max-w-4xl font-semibold leading-[0.9] tracking-[-0.055em] text-white [font-size:clamp(4rem,10vw,8.4rem)]"
            initial={{ opacity: 0, y: 24, filter: "blur(12px)" }}
            animate={{ opacity: 1, y: 0, filter: "blur(0px)" }}
            transition={{ duration: 0.9, delay: 0.12, ease: [0.22, 1, 0.36, 1] }}
          >
            {movie.title}
          </motion.h1>

          <motion.p
            className="mt-6 max-w-2xl text-base leading-7 text-zinc-200 sm:text-lg"
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
            <PremiumButton href={`/watch/${movie.slug}`} className="hero-watch-button min-w-40">
              <Play className="h-4 w-4 fill-current" />
              Қазір көру
            </PremiumButton>
            <PremiumButton href={`/movie/${movie.slug}`} variant="glass" className="min-w-40">
              <Info className="h-4 w-4" />
              Толығырақ
            </PremiumButton>
          </motion.div>
        </div>

        <motion.div
          className="relative mx-auto hidden w-full max-w-[360px] pb-8 lg:block"
          style={{ rotateX: posterRotateX, rotateY: posterRotateY, y: posterY, transformPerspective: 1000 }}
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

      <motion.div
        className="absolute bottom-6 left-1/2 z-10 grid w-[min(92vw,780px)] -translate-x-1/2 grid-cols-3 gap-2 sm:bottom-8 sm:gap-3"
        initial={{ opacity: 0, y: 26 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.7, delay: 0.55 }}
      >
        {[
          ["4K", "Кино сапасы"],
          [movie.rating, "Рейтинг"],
          [formatMovieLanguages(movie.languages, "short"), "Тілдер"]
        ].map(([value, label]) => (
          <div key={label} className="glass rounded-2xl px-4 py-3 text-center">
            <p className="text-lg font-semibold text-white">{value}</p>
            <p className="mt-1 text-[10px] uppercase tracking-[0.2em] text-zinc-500 sm:text-[11px]">
              {label}
            </p>
          </div>
        ))}
      </motion.div>
    </section>
  );
}
