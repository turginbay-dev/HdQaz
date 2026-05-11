import { ApiError } from "@/lib/api/errors";
import { getOptionalAdminClient } from "@/lib/supabase/admin";
import { movies } from "@/features/movies/data";
import { normalizeMovieLanguages } from "@/lib/movie-taxonomy";
import type { Movie } from "@/types/movie";
import type { MovieInput, MovieRecord } from "@/types/backend";

export type MovieListFilters = {
  catalog?: string;
  filter?: string;
  genre?: string;
  includeDrafts?: boolean;
  language?: string;
  limit?: number;
  offset?: number;
  q?: string;
};

type SupabaseMovieRow = {
  id: string;
  slug: string;
  title: string;
  original_title: string;
  year: number;
  runtime: string;
  rating: string;
  description: string;
  poster_url: string;
  backdrop_url: string;
  badges: string[] | null;
  languages: string[] | null;
  genres: string[] | null;
  catalogs: string[] | null;
  is_premium: boolean;
  is_new_release: boolean;
  stream_master: string;
  tmdb_id: number | null;
  quality: string | null;
  published: boolean;
  created_at: string;
  updated_at: string;
};

type MovieRowPatch = Partial<Omit<SupabaseMovieRow, "created_at" | "updated_at">>;

function seedMovies(): MovieRecord[] {
  return movies.map((movie) => ({
    ...movie,
    quality: "1080p",
    published: true
  }));
}

function rowToMovie(row: SupabaseMovieRow): MovieRecord {
  return {
    id: row.id,
    slug: row.slug,
    title: row.title,
    originalTitle: row.original_title,
    year: row.year,
    runtime: row.runtime,
    rating: row.rating,
    description: row.description,
    posterUrl: row.poster_url,
    backdropUrl: row.backdrop_url,
    badges: (row.badges ?? []) as Movie["badges"],
    languages: normalizeMovieLanguages(row.languages),
    genres: row.genres ?? [],
    catalogs: (row.catalogs ?? []) as Movie["catalogs"],
    isPremium: row.is_premium,
    isNewRelease: row.is_new_release,
    streams: {
      master: row.stream_master
    },
    tmdbId: row.tmdb_id,
    quality: row.quality ?? undefined,
    published: row.published,
    createdAt: row.created_at,
    updatedAt: row.updated_at
  };
}

function movieToRow(input: MovieInput): MovieRowPatch {
  return {
    ...(input.id ? { id: input.id } : {}),
    slug: input.slug,
    title: input.title,
    original_title: input.originalTitle,
    year: input.year,
    runtime: input.runtime,
    rating: input.rating,
    description: input.description,
    poster_url: input.posterUrl,
    backdrop_url: input.backdropUrl,
    badges: input.badges,
    languages: input.languages,
    genres: input.genres,
    catalogs: input.catalogs,
    is_premium: input.isPremium,
    is_new_release: input.isNewRelease,
    stream_master: input.streams.master,
    tmdb_id: input.tmdbId ?? null,
    quality: input.quality ?? "1080p",
    published: input.published ?? false
  };
}

function moviePatchToRow(input: Partial<MovieInput>): MovieRowPatch {
  const patch: MovieRowPatch = {};

  if (input.id) patch.id = input.id;
  if (input.slug) patch.slug = input.slug;
  if (input.title) patch.title = input.title;
  if (input.originalTitle) patch.original_title = input.originalTitle;
  if (input.year !== undefined) patch.year = input.year;
  if (input.runtime) patch.runtime = input.runtime;
  if (input.rating) patch.rating = input.rating;
  if (input.description) patch.description = input.description;
  if (input.posterUrl) patch.poster_url = input.posterUrl;
  if (input.backdropUrl) patch.backdrop_url = input.backdropUrl;
  if (input.badges) patch.badges = input.badges;
  if (input.languages) patch.languages = input.languages;
  if (input.genres) patch.genres = input.genres;
  if (input.catalogs) patch.catalogs = input.catalogs;
  if (input.isPremium !== undefined) patch.is_premium = input.isPremium;
  if (input.isNewRelease !== undefined) patch.is_new_release = input.isNewRelease;
  if (input.streams) patch.stream_master = input.streams.master;
  if (input.tmdbId !== undefined) patch.tmdb_id = input.tmdbId;
  if (input.quality) patch.quality = input.quality;
  if (input.published !== undefined) patch.published = input.published;

  return patch;
}

function matchesLegacyFilter(movie: MovieRecord, filter?: string) {
  if (!filter) {
    return true;
  }

  if (filter === "new") {
    return movie.isNewRelease;
  }

  if (filter === "dubbed") {
    return movie.badges.includes("Қазақша дыбыстама");
  }

  if (filter === "subtitles") {
    return movie.badges.includes("Қазақша субтитрмен");
  }

  if (filter === "premium") {
    return movie.isPremium;
  }

  return true;
}

function applyMovieFilters(records: MovieRecord[], filters: MovieListFilters = {}) {
  const query = filters.q?.trim().toLowerCase();
  const genre = filters.genre?.trim();
  const catalog = filters.catalog?.trim();
  const language = filters.language?.trim();
  const offset = filters.offset ?? 0;
  const limit = filters.limit ?? records.length;

  return records
    .filter((movie) => filters.includeDrafts || movie.published)
    .filter((movie) => !genre || movie.genres.includes(genre))
    .filter((movie) => !catalog || movie.catalogs.includes(catalog as Movie["catalogs"][number]))
    .filter((movie) => !language || movie.languages.includes(language as Movie["languages"][number]))
    .filter((movie) => matchesLegacyFilter(movie, filters.filter?.trim()))
    .filter((movie) => {
      if (!query) {
        return true;
      }

      return [movie.title, movie.originalTitle, movie.description, movie.slug]
        .join(" ")
        .toLowerCase()
        .includes(query);
    })
    .slice(offset, offset + limit);
}

function requireDatabase() {
  const supabase = getOptionalAdminClient();

  if (!supabase) {
    throw new ApiError(
      503,
      "database_not_configured",
      "Write operations require NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY."
    );
  }

  return supabase;
}

function throwDatabaseError(error: { code?: string; message: string }, fallback: string): never {
  if (error.code === "23505") {
    throw new ApiError(409, "conflict", "A movie with this slug already exists.");
  }

  throw new ApiError(500, "database_error", fallback, error.message);
}

export async function listMovies(filters: MovieListFilters = {}) {
  const supabase = getOptionalAdminClient();

  if (!supabase) {
    return applyMovieFilters(seedMovies(), filters);
  }

  const { data, error } = await supabase.from("movies").select("*").order("created_at", { ascending: false });

  if (error) {
    throwDatabaseError(error, "Failed to load movies.");
  }

  return applyMovieFilters(((data ?? []) as SupabaseMovieRow[]).map(rowToMovie), filters);
}

export async function getMovieBySlug(slug: string, options: { includeDrafts?: boolean } = {}) {
  const supabase = getOptionalAdminClient();

  if (!supabase) {
    return seedMovies().find((movie) => movie.slug === slug && (options.includeDrafts || movie.published)) ?? null;
  }

  let query = supabase.from("movies").select("*").eq("slug", slug);

  if (!options.includeDrafts) {
    query = query.eq("published", true);
  }

  const { data, error } = await query.maybeSingle();

  if (error) {
    throwDatabaseError(error, "Failed to load movie.");
  }

  return data ? rowToMovie(data as SupabaseMovieRow) : null;
}

export async function createMovie(input: MovieInput) {
  const supabase = requireDatabase();
  const { data, error } = await supabase.from("movies").insert(movieToRow(input)).select("*").single();

  if (error) {
    throwDatabaseError(error, "Failed to create movie.");
  }

  return rowToMovie(data as SupabaseMovieRow);
}

export async function updateMovie(slug: string, input: Partial<MovieInput>) {
  const supabase = requireDatabase();
  const row = moviePatchToRow(input);

  if (Object.keys(row).length === 0) {
    throw new ApiError(400, "empty_patch", "At least one field is required.");
  }

  const { data, error } = await supabase.from("movies").update(row).eq("slug", slug).select("*").maybeSingle();

  if (error) {
    throwDatabaseError(error, "Failed to update movie.");
  }

  if (!data) {
    throw new ApiError(404, "not_found", "Movie not found.");
  }

  return rowToMovie(data as SupabaseMovieRow);
}

export async function deleteMovie(slug: string) {
  const supabase = requireDatabase();
  const { data, error } = await supabase.from("movies").delete().eq("slug", slug).select("id").maybeSingle();

  if (error) {
    throwDatabaseError(error, "Failed to delete movie.");
  }

  return Boolean(data);
}
