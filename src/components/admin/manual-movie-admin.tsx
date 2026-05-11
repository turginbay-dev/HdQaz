"use client";

import { useMemo, useState } from "react";
import { Check, Eye, ImageIcon, Plus } from "lucide-react";
import { getCatalogLabel, movieCatalogs, movieGenres, type MovieCatalogId } from "@/lib/movie-taxonomy";
import type { Movie } from "@/types/movie";

type AdminMovie = {
  id: string;
  title: string;
  originalTitle: string;
  slug: string;
  year: string;
  rating: string;
  runtime: string;
  description: string;
  posterUrl: string;
  backdropUrl: string;
  streamUrl: string;
  localization: string;
  quality: string;
  genres: string[];
  catalogs: MovieCatalogId[];
  premium: boolean;
  published: boolean;
};

type ManualMovieAdminProps = {
  initialMovies: Movie[];
};

function createEmptyMovie(): AdminMovie {
  return {
    id: "",
    title: "",
    originalTitle: "",
    slug: "",
    year: "",
    rating: "",
    runtime: "",
    description: "",
    posterUrl: "",
    backdropUrl: "",
    streamUrl: "",
    localization: "Қазақша дыбыстама",
    quality: "1080p",
    genres: ["Драма"],
    catalogs: ["full-hd", "kazakh-dubbed"],
    premium: false,
    published: false
  };
}

function slugify(value: string) {
  return value
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9а-яәғқңөұүһі]+/gi, "-")
    .replace(/^-+|-+$/g, "");
}

function toAdminMovie(item: Movie & { published?: boolean; quality?: string }): AdminMovie {
  return {
    id: item.id,
    title: item.title,
    originalTitle: item.originalTitle,
    slug: item.slug,
    year: String(item.year),
    rating: item.rating,
    runtime: item.runtime,
    description: item.description,
    posterUrl: item.posterUrl,
    backdropUrl: item.backdropUrl,
    streamUrl: item.streams.master,
    localization: item.badges[0] ?? "Қазақша дыбыстама",
    quality: item.quality ?? "1080p",
    genres: item.genres,
    catalogs: item.catalogs,
    premium: item.isPremium,
    published: item.published ?? true
  };
}

export function ManualMovieAdmin({ initialMovies }: ManualMovieAdminProps) {
  const [movie, setMovie] = useState<AdminMovie>(() => createEmptyMovie());
  const [savedMovies, setSavedMovies] = useState<AdminMovie[]>([]);
  const [isSaving, setIsSaving] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);

  const visibleMovies = useMemo(
    () => [...savedMovies, ...initialMovies.map(toAdminMovie)],
    [savedMovies, initialMovies]
  );

  function updateField<T extends keyof AdminMovie>(field: T, value: AdminMovie[T]) {
    setMovie((current) => {
      const next = {
        ...current,
        [field]: value
      };

      if (field === "title" && !current.slug) {
        next.slug = slugify(String(value));
      }

      return next;
    });
  }

  function toggleGenre(genre: string) {
    setMovie((current) => ({
      ...current,
      genres: current.genres.includes(genre)
        ? current.genres.filter((item) => item !== genre)
        : [...current.genres, genre]
    }));
  }

  function toggleCatalog(catalog: string) {
    const catalogId = catalog as MovieCatalogId;

    setMovie((current) => ({
      ...current,
      catalogs: current.catalogs.includes(catalogId)
        ? current.catalogs.filter((item) => item !== catalogId)
        : [...current.catalogs, catalogId]
    }));
  }

  const canSave =
    Boolean(
      movie.title &&
        movie.originalTitle &&
        movie.slug &&
        movie.year &&
        movie.rating &&
        movie.runtime &&
        movie.description &&
        movie.posterUrl &&
        movie.backdropUrl &&
        movie.streamUrl
    ) &&
    movie.genres.length > 0 &&
    movie.catalogs.length > 0;

  async function saveMovie() {
    if (!canSave || isSaving) {
      return;
    }

    setIsSaving(true);
    setFormError(null);

    try {
      const slug = movie.slug || slugify(movie.title);
      const response = await fetch("/api/movies", {
        method: "POST",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          slug,
          title: movie.title,
          originalTitle: movie.originalTitle,
          year: Number(movie.year),
          runtime: movie.runtime,
          rating: movie.rating,
          description: movie.description,
          posterUrl: movie.posterUrl,
          backdropUrl: movie.backdropUrl,
          badges: [movie.localization],
          genres: movie.genres,
          catalogs: movie.catalogs,
          isPremium: movie.premium,
          isNewRelease: movie.catalogs.includes("new-releases"),
          streams: {
            master: movie.streamUrl
          },
          quality: movie.quality,
          published: movie.published
        })
      });
      const result = (await response.json().catch(() => null)) as
        | { data?: Movie & { published?: boolean; quality?: string }; error?: { message?: string } }
        | null;

      const savedMovie = result?.data;

      if (!response.ok || !savedMovie) {
        throw new Error(result?.error?.message ?? "Киноны сақтау мүмкін болмады.");
      }

      setSavedMovies((current) => [toAdminMovie(savedMovie), ...current]);
      setMovie(createEmptyMovie());
    } catch (error) {
      setFormError(error instanceof Error ? error.message : "Киноны сақтау мүмкін болмады.");
    } finally {
      setIsSaving(false);
    }
  }

  return (
    <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_420px]">
      <section className="glass-strong rounded-[34px] p-5 sm:p-7">
        <div className="mb-6 flex items-start justify-between gap-4">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.32em] text-[var(--accent)]">
              Manual entry
            </p>
            <h2 className="mt-2 text-2xl font-semibold tracking-tight text-white">
              Киноны қолмен қосу
            </h2>
          </div>
          <span className="rounded-full border border-white/10 bg-white/[0.06] px-3 py-1 text-xs font-medium text-zinc-400">
            Local draft
          </span>
        </div>

        <div className="grid gap-4 md:grid-cols-2">
          <AdminInput
            label="Қазақша атауы"
            value={movie.title}
            onChange={(value) => updateField("title", value)}
            placeholder="Интерстеллар"
          />
          <AdminInput
            label="Оригинал атауы"
            value={movie.originalTitle}
            onChange={(value) => updateField("originalTitle", value)}
            placeholder="Interstellar"
          />
          <AdminInput
            label="Slug"
            value={movie.slug}
            onChange={(value) => updateField("slug", value)}
            placeholder="interstellar"
          />
          <AdminInput
            label="Жылы"
            value={movie.year}
            onChange={(value) => updateField("year", value)}
            placeholder="2014"
          />
          <AdminInput
            label="Рейтинг"
            value={movie.rating}
            onChange={(value) => updateField("rating", value)}
            placeholder="8.7"
          />
          <AdminInput
            label="Ұзақтығы"
            value={movie.runtime}
            onChange={(value) => updateField("runtime", value)}
            placeholder="2 сағ 49 мин"
          />
          <AdminInput
            label="Poster URL"
            value={movie.posterUrl}
            onChange={(value) => updateField("posterUrl", value)}
            placeholder="https://..."
          />
          <AdminInput
            label="Backdrop URL"
            value={movie.backdropUrl}
            onChange={(value) => updateField("backdropUrl", value)}
            placeholder="https://..."
          />
          <AdminInput
            label="HLS master URL"
            value={movie.streamUrl}
            onChange={(value) => updateField("streamUrl", value)}
            placeholder="/demo/interstellar/master.m3u8"
          />
        </div>

        <label className="mt-4 block">
          <span className="text-sm font-medium text-zinc-300">Қазақша сипаттама</span>
          <textarea
            value={movie.description}
            onChange={(event) => updateField("description", event.target.value)}
            className="mt-2 min-h-32 w-full resize-none rounded-3xl border border-white/10 bg-white/[0.06] px-4 py-3 text-sm leading-6 text-white outline-none transition placeholder:text-zinc-600 focus:border-[rgba(217,183,111,0.45)] focus:bg-white/[0.08]"
            placeholder="Кино туралы қысқа, сапалы қазақша сипаттама..."
          />
        </label>

        <div className="mt-4 grid gap-4 md:grid-cols-2">
          <AdminSelect
            label="Статус"
            value={movie.localization}
            onChange={(value) => updateField("localization", value)}
            options={["Қазақша дыбыстама", "Қазақша субтитрмен", "AI қазақша субтитр", "Дыбыстама күтілуде"]}
          />
          <AdminSelect
            label="Сапа"
            value={movie.quality}
            onChange={(value) => updateField("quality", value)}
            options={["720p", "1080p", "4K"]}
          />
        </div>

        <div className="mt-5 grid gap-4 md:grid-cols-2">
          <AdminPillGroup
            label="Жанрлар"
            items={movieGenres.map((genre) => ({ id: genre, label: genre }))}
            selected={movie.genres}
            onToggle={toggleGenre}
          />
          <AdminPillGroup
            label="Каталогтар"
            items={movieCatalogs.map((catalog) => ({ id: catalog.id, label: catalog.label }))}
            selected={movie.catalogs}
            onToggle={toggleCatalog}
          />
        </div>

        <div className="mt-5 flex flex-wrap gap-3">
          <AdminToggle
            label="Premium"
            active={movie.premium}
            onClick={() => updateField("premium", !movie.premium)}
          />
          <AdminToggle
            label="Published"
            active={movie.published}
            onClick={() => updateField("published", !movie.published)}
          />
        </div>

        <button
          className="cinema-sweep mt-6 inline-flex min-h-[52px] w-full items-center justify-center gap-2 rounded-full bg-white px-5 text-sm font-semibold text-black shadow-[0_18px_70px_rgba(255,255,255,0.16)] transition hover:bg-[#f3ead5] disabled:cursor-not-allowed disabled:opacity-50 sm:w-auto"
          disabled={!canSave || isSaving}
          onClick={saveMovie}
          type="button"
        >
          <Plus className="h-4 w-4" />
          {isSaving ? "Сақталып жатыр..." : "DB-ге сақтау"}
        </button>
        {formError ? (
          <p className="mt-3 max-w-2xl text-sm leading-6 text-red-300">
            {formError}
          </p>
        ) : null}
      </section>

      <aside className="space-y-4">
        <section className="glass rounded-[30px] p-5">
          <div className="mb-4 flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-[rgba(217,183,111,0.16)] text-[var(--accent)]">
              <Eye className="h-5 w-5" />
            </div>
            <div>
              <h3 className="font-semibold text-white">Preview</h3>
              <p className="text-xs text-zinc-500">Постер URL енгізсең көрінеді</p>
            </div>
          </div>

          <div className="overflow-hidden rounded-[26px] border border-white/10 bg-white/[0.045]">
            {movie.posterUrl ? (
              <img src={movie.posterUrl} alt={movie.title || "Poster preview"} className="aspect-[2/3] w-full object-cover" />
            ) : (
              <div className="flex aspect-[2/3] items-center justify-center text-zinc-600">
                <ImageIcon className="h-10 w-10" />
              </div>
            )}
          </div>
          <h3 className="mt-4 truncate text-lg font-semibold text-white">{movie.title || "Кино атауы"}</h3>
          <p className="mt-1 text-sm text-zinc-500">
            {movie.year || "Жыл"} · {movie.rating || "Рейтинг"} · {movie.quality}
          </p>
          <div className="mt-3 flex flex-wrap gap-1.5">
            {movie.genres.slice(0, 3).map((genre) => (
              <span key={genre} className="rounded-full border border-white/10 bg-white/[0.06] px-2.5 py-1 text-[11px] font-semibold text-zinc-300">
                {genre}
              </span>
            ))}
            {movie.catalogs.slice(0, 2).map((catalog) => (
              <span key={catalog} className="rounded-full border border-[rgba(217,183,111,0.24)] bg-[rgba(217,183,111,0.1)] px-2.5 py-1 text-[11px] font-semibold text-[var(--accent)]">
                {getCatalogLabel(catalog)}
              </span>
            ))}
          </div>
        </section>

        <section className="glass rounded-[30px] p-5">
          <h3 className="mb-4 font-semibold text-white">Admin checklist</h3>
          {[
            "Қазақша сипаттама қолмен жазылады",
            "Жанр мен каталог міндетті түрде белгіленеді",
            "Постер/backdrop және HLS stream URL арқылы сақталады",
            "Save real DB `/api/movies` арқылы Supabase-ке жазады"
          ].map((item) => (
            <div key={item} className="flex items-center gap-3 border-t border-white/10 py-3 first:border-t-0 first:pt-0">
              <Check className="h-4 w-4 text-[var(--accent)]" />
              <span className="text-sm text-zinc-300">{item}</span>
            </div>
          ))}
        </section>
      </aside>

      <section className="xl:col-span-2">
        <div className="mb-4 flex items-center justify-between gap-4">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.32em] text-[var(--accent)]">
              Movies
            </p>
            <h2 className="mt-2 text-2xl font-semibold tracking-tight text-white">Кино тізімі</h2>
          </div>
          <span className="glass rounded-full px-4 py-2 text-sm font-medium text-zinc-300">
            {visibleMovies.length} item
          </span>
        </div>

        <div className="grid gap-3">
          {visibleMovies.map((item) => (
            <article
              key={item.id}
              className="glass flex items-center gap-4 rounded-[26px] p-3"
            >
              <img
                src={item.posterUrl}
                alt={item.title}
                className="h-24 w-16 rounded-2xl object-cover"
              />
              <div className="min-w-0 flex-1">
                <h3 className="truncate font-semibold text-white">{item.title}</h3>
                <p className="mt-1 truncate text-sm text-zinc-500">
                  {item.year} · {item.rating} · {item.localization}
                </p>
                <p className="mt-1 truncate text-xs text-zinc-600">
                  {item.genres.join(", ")} · {item.catalogs.map(getCatalogLabel).join(", ")}
                </p>
              </div>
              <div className="hidden items-center gap-2 sm:flex">
                <StatusPill active={item.published} label={item.published ? "Published" : "Draft"} />
                <StatusPill active={item.premium} label={item.premium ? "Premium" : "Free"} />
              </div>
            </article>
          ))}
        </div>
      </section>
    </div>
  );
}

function AdminPillGroup({
  items,
  label,
  onToggle,
  selected
}: {
  items: Array<{ id: string; label: string }>;
  label: string;
  onToggle: (value: string) => void;
  selected: string[];
}) {
  return (
    <div>
      <span className="text-sm font-medium text-zinc-300">{label}</span>
      <div className="mt-2 flex flex-wrap gap-2 rounded-[26px] border border-white/10 bg-white/[0.04] p-3">
        {items.map((item) => {
          const active = selected.includes(item.id);

          return (
            <button
              key={item.id}
              className={
                active
                  ? "rounded-full border border-[rgba(217,183,111,0.36)] bg-[rgba(217,183,111,0.16)] px-3 py-2 text-xs font-semibold text-[var(--accent)]"
                  : "rounded-full border border-white/10 bg-white/[0.05] px-3 py-2 text-xs font-semibold text-zinc-400 transition hover:border-white/20 hover:text-white"
              }
              onClick={() => onToggle(item.id)}
              type="button"
            >
              {item.label}
            </button>
          );
        })}
      </div>
    </div>
  );
}

function AdminInput({
  label,
  value,
  placeholder,
  onChange
}: {
  label: string;
  value: string;
  placeholder: string;
  onChange: (value: string) => void;
}) {
  return (
    <label className="block">
      <span className="text-sm font-medium text-zinc-300">{label}</span>
      <input
        value={value}
        onChange={(event) => onChange(event.target.value)}
        className="mt-2 min-h-12 w-full rounded-full border border-white/10 bg-white/[0.06] px-4 text-sm text-white outline-none transition placeholder:text-zinc-600 focus:border-[rgba(217,183,111,0.45)] focus:bg-white/[0.08]"
        placeholder={placeholder}
      />
    </label>
  );
}

function AdminSelect({
  label,
  value,
  options,
  onChange
}: {
  label: string;
  value: string;
  options: string[];
  onChange: (value: string) => void;
}) {
  return (
    <label className="block">
      <span className="text-sm font-medium text-zinc-300">{label}</span>
      <select
        value={value}
        onChange={(event) => onChange(event.target.value)}
        className="mt-2 min-h-12 w-full rounded-full border border-white/10 bg-[#111116] px-4 text-sm text-white outline-none transition focus:border-[rgba(217,183,111,0.45)]"
      >
        {options.map((option) => (
          <option key={option}>{option}</option>
        ))}
      </select>
    </label>
  );
}

function AdminToggle({
  label,
  active,
  onClick
}: {
  label: string;
  active: boolean;
  onClick: () => void;
}) {
  return (
    <button
      className={
        active
          ? "rounded-full border border-[rgba(217,183,111,0.38)] bg-[rgba(217,183,111,0.16)] px-4 py-2 text-sm font-semibold text-[var(--accent)]"
          : "glass-button rounded-full px-4 py-2 text-sm font-semibold text-zinc-300"
      }
      onClick={onClick}
      type="button"
    >
      {label}
    </button>
  );
}

function StatusPill({ active, label }: { active: boolean; label: string }) {
  return (
    <span
      className={
        active
          ? "rounded-full border border-[rgba(217,183,111,0.34)] bg-[rgba(217,183,111,0.14)] px-3 py-1 text-xs font-semibold text-[var(--accent)]"
          : "rounded-full border border-white/10 bg-white/[0.06] px-3 py-1 text-xs font-semibold text-zinc-400"
      }
    >
      {label}
    </span>
  );
}
