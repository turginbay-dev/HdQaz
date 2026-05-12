import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { ApiError } from "@/lib/api/errors";
import { normalizeMovieImageUrl } from "@/lib/movie-images";
import { getOptionalAdminClient } from "@/lib/supabase/admin";
import { getSupabaseConfig } from "@/lib/supabase/config";
import { movies } from "@/features/movies/data";
import { formatDurationMinutes, formatEpisodeCount, slugifyContent } from "@/features/content/format";
import type { Content, ContentInput, ContentStatus, ContentType, Dubber, DubberInput, Episode, EpisodeInput, Genre } from "@/types/content";
import type { MovieRecord } from "@/types/backend";

export type ContentListFilters = {
  includeDrafts?: boolean;
  limit?: number;
  offset?: number;
  q?: string;
  status?: ContentStatus;
  type?: ContentType;
};

type ContentRow = {
  id: string;
  title: string;
  slug: string;
  type: ContentType;
  description: string;
  poster_url: string;
  banner_url: string;
  trailer_url: string | null;
  country: string;
  year: number;
  status: ContentStatus;
  age_rating: string | null;
  duration_minutes: number | null;
  hls_url: string | null;
  dubber_id: string | null;
  is_published: boolean;
  created_at: string;
  updated_at: string;
};

type EpisodeRow = {
  id: string;
  content_id: string;
  episode_number: number;
  title: string | null;
  slug: string;
  description: string | null;
  thumbnail_url: string | null;
  hls_url: string;
  duration_minutes: number | null;
  is_published: boolean;
  created_at: string;
  updated_at: string;
};

type GenreRow = {
  id: string;
  name: string;
  slug: string;
};

type ContentGenreRow = {
  content_id: string;
  genre_id: string;
};

type DubberRow = {
  id: string;
  name: string;
  slug: string;
  logo_url: string | null;
  description: string | null;
  telegram_url: string | null;
  vk_url: string | null;
  support_url: string | null;
  chat_url: string | null;
  is_active: boolean;
  created_at: string;
};

type ContentRowPatch = Partial<Omit<ContentRow, "created_at" | "updated_at">>;
type EpisodeRowPatch = Partial<Omit<EpisodeRow, "created_at" | "updated_at">>;
type DubberRowPatch = Partial<Omit<DubberRow, "created_at">>;

let cachedPublicReadClient: SupabaseClient | null = null;

function getOptionalPublicReadClient() {
  const config = getSupabaseConfig();

  if (!config.url || !config.anonKey) {
    return null;
  }

  cachedPublicReadClient ??= createClient(config.url, config.anonKey, {
    auth: {
      autoRefreshToken: false,
      persistSession: false
    }
  });

  return cachedPublicReadClient;
}

function getOptionalContentReadClient(includeDrafts?: boolean) {
  const adminClient = getOptionalAdminClient();

  if (adminClient) {
    return adminClient;
  }

  return includeDrafts ? null : getOptionalPublicReadClient();
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

function normalizeStoredImageUrl(value: string) {
  return normalizeMovieImageUrl(value) ?? value;
}

function isMissingContentTableError(error: { code?: string; message: string }) {
  return error.code === "42P01" || error.code === "PGRST205" || error.message.includes("Could not find the table");
}

function throwDatabaseError(error: { code?: string; message: string }, fallback: string): never {
  if (error.code === "23505") {
    throw new ApiError(409, "conflict", "A record with this slug or number already exists.");
  }

  throw new ApiError(500, "database_error", fallback, error.message);
}

function rowToGenre(row: GenreRow): Genre {
  return {
    id: row.id,
    name: row.name,
    slug: row.slug
  };
}

function rowToDubber(row: DubberRow): Dubber {
  return {
    id: row.id,
    name: row.name,
    slug: row.slug,
    logoUrl: row.logo_url,
    description: row.description,
    telegramUrl: row.telegram_url,
    vkUrl: row.vk_url,
    supportUrl: row.support_url,
    chatUrl: row.chat_url,
    isActive: row.is_active,
    createdAt: row.created_at
  };
}

function rowToEpisode(row: EpisodeRow): Episode {
  return {
    id: row.id,
    contentId: row.content_id,
    episodeNumber: row.episode_number,
    title: row.title,
    slug: row.slug,
    description: row.description,
    thumbnailUrl: row.thumbnail_url,
    hlsUrl: row.hls_url,
    durationMinutes: row.duration_minutes,
    isPublished: row.is_published,
    createdAt: row.created_at,
    updatedAt: row.updated_at
  };
}

function rowToContent(
  row: ContentRow,
  relations: {
    dubber?: Dubber | null;
    episodes?: Episode[];
    genres?: Genre[];
  } = {}
): Content {
  const episodes = relations.episodes ?? [];

  return {
    id: row.id,
    title: row.title,
    slug: row.slug,
    type: row.type,
    description: row.description,
    posterUrl: normalizeStoredImageUrl(row.poster_url),
    bannerUrl: normalizeStoredImageUrl(row.banner_url),
    trailerUrl: row.trailer_url,
    country: row.country,
    year: row.year,
    status: row.status,
    ageRating: row.age_rating,
    durationMinutes: row.duration_minutes,
    hlsUrl: row.hls_url,
    dubberId: row.dubber_id,
    dubber: relations.dubber ?? null,
    genres: relations.genres ?? [],
    episodes,
    episodeCount: episodes.length,
    isPublished: row.is_published,
    createdAt: row.created_at,
    updatedAt: row.updated_at
  };
}

function contentToRow(input: ContentInput): ContentRowPatch {
  return {
    ...(input.id ? { id: input.id } : {}),
    title: input.title,
    slug: input.slug,
    type: input.type,
    description: input.description,
    poster_url: normalizeStoredImageUrl(input.posterUrl),
    banner_url: normalizeStoredImageUrl(input.bannerUrl),
    trailer_url: input.trailerUrl ?? null,
    country: input.country,
    year: input.year,
    status: input.status,
    age_rating: input.ageRating ?? null,
    duration_minutes: input.durationMinutes ?? null,
    hls_url: input.hlsUrl ?? null,
    dubber_id: input.dubberId ?? null,
    is_published: input.isPublished ?? false
  };
}

function episodeToRow(input: EpisodeInput, contentId: string): EpisodeRowPatch {
  return {
    ...(input.id ? { id: input.id } : {}),
    content_id: contentId,
    episode_number: input.episodeNumber,
    title: input.title ?? null,
    slug: input.slug?.trim() || String(input.episodeNumber),
    description: input.description ?? null,
    thumbnail_url: input.thumbnailUrl ?? null,
    hls_url: input.hlsUrl,
    duration_minutes: input.durationMinutes ?? null,
    is_published: input.isPublished ?? false
  };
}

function dubberToRow(input: DubberInput): DubberRowPatch {
  return {
    ...(input.id ? { id: input.id } : {}),
    name: input.name,
    slug: input.slug,
    logo_url: input.logoUrl ? normalizeStoredImageUrl(input.logoUrl) : null,
    description: input.description ?? null,
    telegram_url: input.telegramUrl ?? null,
    vk_url: input.vkUrl ?? null,
    support_url: input.supportUrl ?? null,
    chat_url: input.chatUrl ?? null,
    is_active: input.isActive ?? true
  };
}

function seedContents(): Content[] {
  return movies.map((movie) => ({
    id: movie.id,
    title: movie.title,
    slug: movie.slug,
    type: "movie",
    description: movie.description,
    posterUrl: normalizeStoredImageUrl(movie.posterUrl),
    bannerUrl: normalizeStoredImageUrl(movie.backdropUrl),
    trailerUrl: null,
    country: "",
    year: movie.year,
    status: "completed",
    ageRating: null,
    durationMinutes: null,
    hlsUrl: movie.streams.master,
    dubberId: null,
    dubber: null,
    genres: movie.genres.map((name) => ({
      id: slugifyContent(name),
      name,
      slug: slugifyContent(name)
    })),
    episodes: [],
    episodeCount: 0,
    isPublished: true
  }));
}

function applyContentFilters(records: Content[], filters: ContentListFilters = {}) {
  const query = filters.q?.trim().toLowerCase();
  const offset = filters.offset ?? 0;
  const limit = filters.limit ?? records.length;

  return records
    .filter((content) => filters.includeDrafts || content.isPublished)
    .filter((content) => !filters.type || content.type === filters.type)
    .filter((content) => !filters.status || content.status === filters.status)
    .filter((content) => {
      if (!query) {
        return true;
      }

      return [
        content.title,
        content.country,
        String(content.year),
        content.dubber?.name,
        ...content.genres.map((genre) => genre.name)
      ].some((value) => value?.toLowerCase().includes(query));
    })
    .slice(offset, offset + limit);
}

async function hydrateContents(
  supabase: SupabaseClient,
  rows: ContentRow[],
  options: { includeDrafts?: boolean } = {}
) {
  if (rows.length === 0) {
    return [];
  }

  const contentIds = rows.map((row) => row.id);
  const dubberIds = Array.from(new Set(rows.map((row) => row.dubber_id).filter((value): value is string => Boolean(value))));
  const genresByContentId = new Map<string, Genre[]>();
  const episodesByContentId = new Map<string, Episode[]>();
  const dubbersById = new Map<string, Dubber>();

  const contentGenresQuery = supabase
    .from("content_genres")
    .select("content_id, genre_id")
    .in("content_id", contentIds);
  const episodesQuery = supabase
    .from("episodes")
    .select("*")
    .in("content_id", contentIds)
    .order("content_id", { ascending: true })
    .order("episode_number", { ascending: true });

  const [contentGenresResult, episodesResult, dubbersResult] = await Promise.all([
    contentGenresQuery,
    options.includeDrafts ? episodesQuery : episodesQuery.eq("is_published", true),
    dubberIds.length > 0 ? supabase.from("dubbers").select("*").in("id", dubberIds) : Promise.resolve({ data: [], error: null })
  ]);

  if (contentGenresResult.error) {
    throwDatabaseError(contentGenresResult.error, "Failed to load content genres.");
  }

  if (episodesResult.error) {
    throwDatabaseError(episodesResult.error, "Failed to load episodes.");
  }

  if (dubbersResult.error) {
    throwDatabaseError(dubbersResult.error, "Failed to load dubbers.");
  }

  const contentGenreRows = (contentGenresResult.data ?? []) as ContentGenreRow[];
  const genreIds = Array.from(new Set(contentGenreRows.map((row) => row.genre_id)));
  const genresResult = genreIds.length > 0
    ? await supabase.from("genres").select("*").in("id", genreIds)
    : { data: [], error: null };

  if (genresResult.error) {
    throwDatabaseError(genresResult.error, "Failed to load genres.");
  }

  const genresById = new Map((genresResult.data ?? []).map((row) => {
    const genre = rowToGenre(row as GenreRow);
    return [genre.id, genre] as const;
  }));

  for (const row of contentGenreRows) {
    const genre = genresById.get(row.genre_id);

    if (!genre) {
      continue;
    }

    genresByContentId.set(row.content_id, [...(genresByContentId.get(row.content_id) ?? []), genre]);
  }

  for (const row of (episodesResult.data ?? []) as EpisodeRow[]) {
    episodesByContentId.set(row.content_id, [...(episodesByContentId.get(row.content_id) ?? []), rowToEpisode(row)]);
  }

  for (const row of (dubbersResult.data ?? []) as DubberRow[]) {
    const dubber = rowToDubber(row);
    dubbersById.set(dubber.id, dubber);
  }

  return rows.map((row) =>
    rowToContent(row, {
      dubber: row.dubber_id ? dubbersById.get(row.dubber_id) ?? null : null,
      episodes: episodesByContentId.get(row.id) ?? [],
      genres: genresByContentId.get(row.id) ?? []
    })
  );
}

export async function listContents(filters: ContentListFilters = {}) {
  const supabase = getOptionalContentReadClient(filters.includeDrafts);

  if (!supabase) {
    return applyContentFilters(seedContents(), filters);
  }

  let query = supabase.from("contents").select("*").order("created_at", { ascending: false });

  if (!filters.includeDrafts) {
    query = query.eq("is_published", true);
  }

  if (filters.type) {
    query = query.eq("type", filters.type);
  }

  if (filters.status) {
    query = query.eq("status", filters.status);
  }

  const { data, error } = await query;

  if (error) {
    if (isMissingContentTableError(error)) {
      return applyContentFilters(seedContents(), filters);
    }

    throwDatabaseError(error, "Failed to load contents.");
  }

  return applyContentFilters(await hydrateContents(supabase, (data ?? []) as ContentRow[], filters), filters);
}

export async function getContentBySlug(slug: string, options: { includeDrafts?: boolean } = {}) {
  const supabase = getOptionalContentReadClient(options.includeDrafts);

  if (!supabase) {
    return seedContents().find((content) => content.slug === slug && (options.includeDrafts || content.isPublished)) ?? null;
  }

  let query = supabase.from("contents").select("*").eq("slug", slug);

  if (!options.includeDrafts) {
    query = query.eq("is_published", true);
  }

  const { data, error } = await query.maybeSingle();

  if (error) {
    if (isMissingContentTableError(error)) {
      return seedContents().find((content) => content.slug === slug && (options.includeDrafts || content.isPublished)) ?? null;
    }

    throwDatabaseError(error, "Failed to load content.");
  }

  if (!data) {
    return null;
  }

  const [content] = await hydrateContents(supabase, [data as ContentRow], options);

  return content ?? null;
}

export async function listGenres() {
  const supabase = getOptionalContentReadClient(true);

  if (!supabase) {
    const genres = seedContents().flatMap((content) => content.genres);
    return Array.from(new Map(genres.map((genre) => [genre.slug, genre])).values());
  }

  const { data, error } = await supabase.from("genres").select("*").order("name", { ascending: true });

  if (error) {
    if (isMissingContentTableError(error)) {
      const genres = seedContents().flatMap((content) => content.genres);
      return Array.from(new Map(genres.map((genre) => [genre.slug, genre])).values());
    }

    throwDatabaseError(error, "Failed to load genres.");
  }

  return ((data ?? []) as GenreRow[]).map(rowToGenre);
}

export async function listDubbers(options: { includeInactive?: boolean } = {}) {
  const supabase = getOptionalContentReadClient(options.includeInactive);

  if (!supabase) {
    return [];
  }

  let query = supabase.from("dubbers").select("*").order("name", { ascending: true });

  if (!options.includeInactive) {
    query = query.eq("is_active", true);
  }

  const { data, error } = await query;

  if (error) {
    if (isMissingContentTableError(error)) {
      return [];
    }

    throwDatabaseError(error, "Failed to load dubbers.");
  }

  return ((data ?? []) as DubberRow[]).map(rowToDubber);
}

export async function createDubber(input: DubberInput) {
  const supabase = requireDatabase();
  const { data, error } = await supabase.from("dubbers").insert(dubberToRow(input)).select("*").single();

  if (error) {
    throwDatabaseError(error, "Failed to create dubber.");
  }

  return rowToDubber(data as DubberRow);
}

export async function updateDubber(id: string, input: DubberInput) {
  const supabase = requireDatabase();
  const { data, error } = await supabase.from("dubbers").update(dubberToRow(input)).eq("id", id).select("*").maybeSingle();

  if (error) {
    throwDatabaseError(error, "Failed to update dubber.");
  }

  if (!data) {
    throw new ApiError(404, "not_found", "Dubber not found.");
  }

  return rowToDubber(data as DubberRow);
}

async function syncContentGenres(supabase: SupabaseClient, contentId: string, genreIds: string[]) {
  const { error: deleteError } = await supabase.from("content_genres").delete().eq("content_id", contentId);

  if (deleteError) {
    throwDatabaseError(deleteError, "Failed to update content genres.");
  }

  if (genreIds.length === 0) {
    return;
  }

  const { error: insertError } = await supabase.from("content_genres").insert(
    genreIds.map((genreId) => ({
      content_id: contentId,
      genre_id: genreId
    }))
  );

  if (insertError) {
    throwDatabaseError(insertError, "Failed to update content genres.");
  }
}

export async function createContent(input: ContentInput) {
  const supabase = requireDatabase();
  const { data, error } = await supabase.from("contents").insert(contentToRow(input)).select("*").single();

  if (error) {
    throwDatabaseError(error, "Failed to create content.");
  }

  await syncContentGenres(supabase, (data as ContentRow).id, input.genreIds);

  const content = await getContentBySlug((data as ContentRow).slug, { includeDrafts: true });

  if (!content) {
    throw new ApiError(500, "database_error", "Content was created but could not be loaded.");
  }

  return content;
}

export async function updateContent(slug: string, input: ContentInput) {
  const supabase = requireDatabase();
  const row = contentToRow(input);
  const { data, error } = await supabase.from("contents").update(row).eq("slug", slug).select("*").maybeSingle();

  if (error) {
    throwDatabaseError(error, "Failed to update content.");
  }

  if (!data) {
    throw new ApiError(404, "not_found", "Content not found.");
  }

  await syncContentGenres(supabase, (data as ContentRow).id, input.genreIds);

  const content = await getContentBySlug((data as ContentRow).slug, { includeDrafts: true });

  if (!content) {
    throw new ApiError(500, "database_error", "Content was updated but could not be loaded.");
  }

  return content;
}

export async function deleteContent(slug: string) {
  const supabase = requireDatabase();
  const { data, error } = await supabase.from("contents").delete().eq("slug", slug).select("id").maybeSingle();

  if (error) {
    throwDatabaseError(error, "Failed to delete content.");
  }

  return Boolean(data);
}

export async function createEpisode(contentSlug: string, input: EpisodeInput) {
  const supabase = requireDatabase();
  const content = await getContentBySlug(contentSlug, { includeDrafts: true });

  if (!content) {
    throw new ApiError(404, "not_found", "Content not found.");
  }

  if (content.type === "movie") {
    throw new ApiError(400, "invalid_content_type", "Movies do not support episodes.");
  }

  const { data, error } = await supabase
    .from("episodes")
    .insert(episodeToRow(input, content.id))
    .select("*")
    .single();

  if (error) {
    throwDatabaseError(error, "Failed to create episode.");
  }

  return rowToEpisode(data as EpisodeRow);
}

export async function updateEpisode(contentSlug: string, episodeId: string, input: EpisodeInput) {
  const supabase = requireDatabase();
  const content = await getContentBySlug(contentSlug, { includeDrafts: true });

  if (!content) {
    throw new ApiError(404, "not_found", "Content not found.");
  }

  const { data, error } = await supabase
    .from("episodes")
    .update(episodeToRow(input, content.id))
    .eq("id", episodeId)
    .eq("content_id", content.id)
    .select("*")
    .maybeSingle();

  if (error) {
    throwDatabaseError(error, "Failed to update episode.");
  }

  if (!data) {
    throw new ApiError(404, "not_found", "Episode not found.");
  }

  return rowToEpisode(data as EpisodeRow);
}

export async function deleteEpisode(contentSlug: string, episodeId: string) {
  const supabase = requireDatabase();
  const content = await getContentBySlug(contentSlug, { includeDrafts: true });

  if (!content) {
    throw new ApiError(404, "not_found", "Content not found.");
  }

  const { data, error } = await supabase
    .from("episodes")
    .delete()
    .eq("id", episodeId)
    .eq("content_id", content.id)
    .select("id")
    .maybeSingle();

  if (error) {
    throwDatabaseError(error, "Failed to delete episode.");
  }

  return Boolean(data);
}

export function contentToMovieRecord(content: Content): MovieRecord {
  const genreNames = content.genres.map((genre) => genre.name);
  const runtime = content.type === "movie"
    ? formatDurationMinutes(content.durationMinutes) || "Кино"
    : formatEpisodeCount(content.episodeCount) || "Сериялар жақында";

  return {
    id: content.id,
    slug: content.slug,
    title: content.title,
    originalTitle: content.title,
    type: content.type,
    year: content.year,
    runtime,
    rating: content.ageRating ?? content.status,
    description: content.description,
    posterUrl: content.posterUrl,
    backdropUrl: content.bannerUrl,
    bannerUrl: content.bannerUrl,
    trailerUrl: content.trailerUrl,
    country: content.country,
    status: content.status,
    ageRating: content.ageRating,
    durationMinutes: content.durationMinutes,
    hlsUrl: content.hlsUrl,
    dubberId: content.dubberId,
    dubber: content.dubber,
    contentGenres: content.genres,
    episodes: content.episodes,
    episodeCount: content.episodeCount,
    isPublished: content.isPublished,
    badges: [],
    languages: ["kk"],
    genres: genreNames,
    catalogs: [
      "full-hd",
      ...(content.dubber ? ["kazakh-dubbed" as const] : []),
      ...(content.status === "ongoing" ? ["new-releases" as const] : [])
    ],
    isPremium: false,
    isNewRelease: content.status === "ongoing",
    streams: {
      master: content.hlsUrl ?? content.episodes[0]?.hlsUrl ?? ""
    },
    published: content.isPublished,
    createdAt: content.createdAt,
    updatedAt: content.updatedAt
  };
}
