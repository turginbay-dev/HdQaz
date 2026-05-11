"use client";

import Link from "next/link";
import { motion } from "framer-motion";
import { Play, Star } from "lucide-react";
import { MovieBadge } from "@/components/movie/movie-badge";
import { MovieImage } from "@/components/movie/movie-image";
import { getCatalogLabel } from "@/lib/movie-taxonomy";
import type { Movie } from "@/types/movie";

type MovieCardProps = {
  movie: Movie;
  priority?: boolean;
};

export function MovieCard({ movie, priority = false }: MovieCardProps) {
  return (
    <motion.div
      className="group relative"
      whileHover={{ y: -10, scale: 1.025 }}
      transition={{ type: "spring", stiffness: 280, damping: 24 }}
    >
      <Link href={`/movie/${movie.slug}`} className="block outline-none">
        <article className="relative overflow-hidden rounded-[24px] border border-white/10 bg-white/[0.045] shadow-[0_24px_80px_rgba(0,0,0,0.28)] transition duration-500 group-hover:border-[rgba(217,183,111,0.35)] group-hover:shadow-[0_28px_110px_rgba(217,183,111,0.14)]">
          <div className="poster-reflection relative aspect-[2/3] overflow-hidden rounded-[24px]">
            <MovieImage
              src={movie.posterUrl}
              alt={movie.title}
              fallback="poster"
              fill
              priority={priority}
              sizes="(max-width: 640px) 42vw, (max-width: 1024px) 24vw, 220px"
              className="object-cover transition duration-700 ease-out group-hover:scale-110"
            />
          </div>

          <div className="absolute inset-0 bg-gradient-to-t from-black via-black/20 to-transparent opacity-[0.76] transition duration-500 group-hover:opacity-95" />
          <div className="absolute inset-0 opacity-0 transition duration-500 group-hover:opacity-100">
            <div className="absolute inset-x-0 top-0 h-28 bg-gradient-to-b from-[rgba(217,183,111,0.18)] to-transparent" />
            <div className="absolute inset-0 ring-1 ring-inset ring-white/10" />
          </div>

          <div className="absolute left-3 right-3 top-3 flex items-center justify-between">
            <span className="glass rounded-full px-2.5 py-1 text-[11px] font-semibold text-white">
              {movie.year}
            </span>
            {movie.isPremium && <MovieBadge label="Premium" />}
          </div>

          <div className="absolute inset-x-3 bottom-3 translate-y-4 opacity-0 transition duration-500 group-hover:translate-y-0 group-hover:opacity-100">
            <div className="glass rounded-[20px] p-3">
              <div className="mb-2 flex flex-wrap gap-1.5">
                {movie.badges.slice(0, 2).map((badge) => (
                  <MovieBadge key={badge} label={badge} />
                ))}
                {movie.genres[0] && (
                  <span className="rounded-full border border-white/10 bg-white/[0.08] px-2.5 py-1 text-[11px] font-semibold text-zinc-200">
                    {movie.genres[0]}
                  </span>
                )}
              </div>
              <div className="flex items-end justify-between gap-3">
                <div className="min-w-0">
                  <h3 className="truncate text-sm font-semibold tracking-tight text-white">
                    {movie.title}
                  </h3>
                  <p className="mt-1 flex items-center gap-1 text-xs text-zinc-300">
                    <Star className="h-3 w-3 fill-[var(--accent)] text-[var(--accent)]" />
                    {movie.rating} · {movie.runtime}
                  </p>
                </div>
                <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-white text-black shadow-[0_12px_35px_rgba(255,255,255,0.22)]">
                  <Play className="h-4 w-4 fill-current" />
                </span>
              </div>
            </div>
          </div>
        </article>

        <div className="mt-3 px-1">
          <h3 className="truncate text-sm font-semibold tracking-tight text-white">
            {movie.title}
          </h3>
          <p className="mt-1 truncate text-xs text-zinc-500">{movie.genres.join(", ")}</p>
          <p className="mt-1 truncate text-[11px] font-medium text-[rgba(217,183,111,0.8)]">
            {movie.catalogs.slice(0, 2).map(getCatalogLabel).join(" · ")}
          </p>
        </div>
      </Link>
    </motion.div>
  );
}
