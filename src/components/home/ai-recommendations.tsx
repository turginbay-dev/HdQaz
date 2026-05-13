import Link from "next/link";
import { Brain, Sparkles } from "lucide-react";
import { MovieBadge } from "@/components/movie/movie-badge";
import { MovieImage } from "@/components/movie/movie-image";
import { Reveal } from "@/components/motion/reveal";
import { contentStatusLabels, contentTypeLabels } from "@/features/content/format";
import type { Movie } from "@/types/movie";

type AiRecommendationsProps = {
  movies: Movie[];
};

const reasons = [
  "Фантастика, кең атмосфера, жоғары қызығушылық",
  "Жаңа релиз, жеңіл эмоция, отбасылық кеш",
  "Қараңғы эстетика, драмалық ырғақ, премиум аудитория"
];

export function AiRecommendations({ movies }: AiRecommendationsProps) {
  return (
    <Reveal>
      <section className="relative overflow-hidden rounded-[34px] border border-white/10 bg-[linear-gradient(135deg,rgba(143,183,255,0.12),rgba(255,255,255,0.035)_38%,rgba(217,183,111,0.1))] p-5 shadow-[0_30px_120px_rgba(0,0,0,0.42)] sm:p-7">
        <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_at_18%_0%,rgba(143,183,255,0.16),transparent_36%),radial-gradient(ellipse_at_90%_20%,rgba(217,183,111,0.14),transparent_32%)]" />

        <div className="relative mb-6 flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <p className="flex items-center gap-2 text-xs font-bold uppercase tracking-[0.24em] text-[var(--accent)]">
              <Brain className="h-3.5 w-3.5" />
              Ұсыныс сигналы
            </p>
            <h2 className="mt-2 text-2xl font-bold tracking-[-0.024em] text-white sm:text-4xl">
              Сізге дәл келетін таңдаулар
            </h2>
          </div>
          <p className="max-w-lg text-sm font-medium leading-6 tracking-[0.004em] text-zinc-400">
            Көру тарихы, жанр, дыбыстама және жаңа релиз сигналы бойынша.
          </p>
        </div>

        <div className="relative grid gap-4 lg:grid-cols-3">
          {movies.map((movie, index) => (
            <Link
              key={movie.id}
              href={`/${movie.slug}`}
              className="group rounded-[28px] border border-white/10 bg-black/[0.28] p-3 transition duration-500 hover:-translate-y-1 hover:border-[rgba(217,183,111,0.28)] hover:bg-white/[0.07]"
            >
              <div className="relative aspect-[16/10] overflow-hidden rounded-[22px]">
                <MovieImage
                  src={movie.backdropUrl}
                  alt={movie.title}
                  fallback="backdrop"
                  fill
                  sizes="(max-width: 1024px) 100vw, 33vw"
                  className="object-cover transition duration-700 group-hover:scale-105"
                />
                <div className="absolute inset-0 bg-gradient-to-t from-black/[0.82] to-transparent" />
                <span className="absolute left-3 top-3 glass rounded-full px-3 py-1 text-xs font-bold tracking-[0.012em] text-white">
                  Сәйкестік {96 - index * 4}%
                </span>
              </div>

              <div className="px-1 pt-4">
                <div className="mb-2 flex flex-wrap gap-1.5">
                  <MovieBadge label={movie.type ? contentTypeLabels[movie.type] : "Movie"} />
                  <MovieBadge label={movie.status ? contentStatusLabels[movie.status] : "Аяқталған"} />
                </div>
                <h3 className="text-lg font-bold tracking-[-0.018em] text-white">{movie.title}</h3>
                <p className="mt-2 flex gap-2 text-sm font-medium leading-6 tracking-[0.004em] text-zinc-400">
                  <Sparkles className="mt-1 h-3.5 w-3.5 shrink-0 text-[var(--accent)]" />
                  {reasons[index]}
                </p>
              </div>
            </Link>
          ))}
        </div>
      </section>
    </Reveal>
  );
}
