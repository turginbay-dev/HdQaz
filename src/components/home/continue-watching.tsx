import Image from "next/image";
import Link from "next/link";
import { Play } from "lucide-react";
import { Reveal } from "@/components/motion/reveal";
import type { Movie } from "@/types/movie";

type ContinueWatchingProps = {
  movies: Movie[];
};

const progress = [68, 42, 21];

export function ContinueWatching({ movies }: ContinueWatchingProps) {
  return (
    <Reveal>
      <section>
        <div className="mb-5 flex items-end justify-between gap-4">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.32em] text-[var(--accent)]">
              Continue
            </p>
            <h2 className="mt-2 text-2xl font-semibold tracking-tight text-white sm:text-4xl">
              Жалғастырып көру
            </h2>
          </div>
          <Link href="/catalog" className="text-sm font-medium text-zinc-400 transition hover:text-white">
            Тарих
          </Link>
        </div>

        <div className="grid gap-4 lg:grid-cols-3">
          {movies.map((movie, index) => (
            <Link
              key={movie.id}
              href={`/watch/${movie.slug}`}
              className="group relative overflow-hidden rounded-[28px] border border-white/10 bg-white/[0.045] p-3 shadow-[0_24px_90px_rgba(0,0,0,0.3)] transition duration-500 hover:-translate-y-1 hover:border-white/20 hover:bg-white/[0.075]"
            >
              <div className="relative aspect-video overflow-hidden rounded-[22px]">
                <Image
                  src={movie.backdropUrl}
                  alt={movie.title}
                  fill
                  sizes="(max-width: 1024px) 100vw, 33vw"
                  className="object-cover transition duration-700 group-hover:scale-105"
                />
                <div className="absolute inset-0 bg-gradient-to-t from-black/[0.84] via-black/10 to-transparent" />
                <span className="absolute bottom-3 left-3 flex h-11 w-11 items-center justify-center rounded-full bg-white text-black shadow-[0_12px_40px_rgba(255,255,255,0.22)]">
                  <Play className="h-4 w-4 fill-current" />
                </span>
              </div>

              <div className="px-1 pt-3">
                <div className="flex items-center justify-between gap-3">
                  <h3 className="truncate text-base font-semibold text-white">{movie.title}</h3>
                  <span className="text-xs font-medium text-zinc-500">{progress[index]}%</span>
                </div>
                <div className="mt-3 h-1.5 overflow-hidden rounded-full bg-white/10">
                  <div
                    className="h-full rounded-full bg-gradient-to-r from-[var(--accent)] to-[var(--accent-strong)]"
                    style={{ width: `${progress[index]}%` }}
                  />
                </div>
              </div>
            </Link>
          ))}
        </div>
      </section>
    </Reveal>
  );
}
