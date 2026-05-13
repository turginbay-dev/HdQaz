import { ApiError } from "@/lib/api/errors";
import { getOptionalAdminClient } from "@/lib/supabase/admin";
import { getAllMovies } from "@/features/movies/queries";
import type { MovieRecord } from "@/types/backend";
import type { ContinueWatchingItem, RecommendationItem, RecommendationResult, WatchHistoryRecord } from "@/features/watch-history/types";

type WatchHistoryRow = {
  id: string;
  user_id: string | null;
  content_id: string;
  progress_seconds: number;
  duration_seconds: number;
  progress_percent: number;
  last_position_seconds: number;
  completed: boolean;
  last_watched_at: string;
  created_at: string;
  updated_at: string;
};

type MovieIdRow = {
  movie_id: string;
};

type MovieViewRow = {
  movie_id: string;
};

const historyMissingErrorCodes = new Set(["42P01", "PGRST205"]);

function requireDatabase() {
  const supabase = getOptionalAdminClient();

  if (!supabase) {
    throw new ApiError(
      503,
      "database_not_configured",
      "Watch history requires NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY."
    );
  }

  return supabase;
}

function isMissingTableError(error: { code?: string; message: string }) {
  return Boolean(
    (error.code && historyMissingErrorCodes.has(error.code)) ||
      error.message.includes("Could not find the table") ||
      (error.message.includes("relation") && error.message.includes("does not exist"))
  );
}

function throwDatabaseError(error: { code?: string; message: string }, fallback: string): never {
  if (error.code === "23503") {
    throw new ApiError(404, "content_not_found", "Content not found.");
  }

  throw new ApiError(500, "database_error", fallback, error.message);
}

function clampInteger(value: number, min: number, max = Number.MAX_SAFE_INTEGER) {
  if (!Number.isFinite(value)) {
    return min;
  }

  return Math.min(max, Math.max(min, Math.round(value)));
}

function clampLimit(limit: number | undefined, fallback: number, max: number) {
  return clampInteger(limit ?? fallback, 1, max);
}

function calculateProgress(progressSeconds: number, durationSeconds: number) {
  const duration = clampInteger(durationSeconds, 0);
  const progress = duration > 0
    ? clampInteger(progressSeconds, 0, duration)
    : clampInteger(progressSeconds, 0);
  const percent = duration > 0 ? clampInteger((progress / duration) * 100, 0, 100) : 0;

  return {
    completed: percent >= 90,
    durationSeconds: duration,
    progressPercent: percent,
    progressSeconds: progress
  };
}

function rowToHistory(row: WatchHistoryRow): WatchHistoryRecord {
  return {
    id: row.id,
    userId: row.user_id,
    contentId: row.content_id,
    progressSeconds: row.progress_seconds,
    durationSeconds: row.duration_seconds,
    progressPercent: row.progress_percent,
    lastPositionSeconds: row.last_position_seconds,
    completed: row.completed,
    lastWatchedAt: row.last_watched_at,
    createdAt: row.created_at,
    updatedAt: row.updated_at
  };
}

async function getMovieMap() {
  const movies = (await getAllMovies()) as MovieRecord[];

  return new Map(movies.map((movie) => [movie.id, movie]));
}

async function rowsToContinueWatchingItems(rows: WatchHistoryRow[]) {
  if (rows.length === 0) {
    return [] as ContinueWatchingItem[];
  }

  const movieById = await getMovieMap();

  return rows
    .map((row) => {
      const movie = movieById.get(row.content_id);

      if (!movie) {
        return null;
      }

      const history = rowToHistory(row);

      return {
        ...history,
        movie,
        remainingSeconds:
          history.durationSeconds > 0
            ? Math.max(0, history.durationSeconds - history.lastPositionSeconds)
            : null
      };
    })
    .filter((item): item is ContinueWatchingItem => Boolean(item));
}

export async function upsertWatchProgress(
  userId: string,
  input: {
    contentId: string;
    durationSeconds: number;
    progressSeconds: number;
  }
) {
  const supabase = requireDatabase();
  const contentResult = await supabase.from("contents").select("id").eq("id", input.contentId).maybeSingle();

  if (contentResult.error) {
    throwDatabaseError(contentResult.error, "Failed to load content.");
  }

  if (!contentResult.data) {
    throw new ApiError(404, "content_not_found", "Content not found.");
  }

  const progress = calculateProgress(input.progressSeconds, input.durationSeconds);
  const { data, error } = await supabase
    .from("watch_history")
    .upsert(
      {
        user_id: userId,
        content_id: input.contentId,
        progress_seconds: progress.progressSeconds,
        duration_seconds: progress.durationSeconds,
        progress_percent: progress.progressPercent,
        last_position_seconds: progress.progressSeconds,
        completed: progress.completed,
        last_watched_at: new Date().toISOString()
      },
      { onConflict: "user_id,content_id" }
    )
    .select("*")
    .single();

  if (error) {
    throwDatabaseError(error, "Failed to save watch history.");
  }

  return rowToHistory(data as WatchHistoryRow);
}

export async function getWatchProgressForContent(userId: string, contentId: string) {
  const supabase = getOptionalAdminClient();

  if (!supabase) {
    return null;
  }

  const { data, error } = await supabase
    .from("watch_history")
    .select("*")
    .eq("user_id", userId)
    .eq("content_id", contentId)
    .maybeSingle();

  if (error) {
    if (isMissingTableError(error)) {
      return null;
    }

    throwDatabaseError(error, "Failed to load watch history.");
  }

  return data ? rowToHistory(data as WatchHistoryRow) : null;
}

export async function getMyWatchHistory(userId: string, limit = 10) {
  const supabase = getOptionalAdminClient();

  if (!supabase) {
    return [] as ContinueWatchingItem[];
  }

  const { data, error } = await supabase
    .from("watch_history")
    .select("*")
    .eq("user_id", userId)
    .eq("completed", false)
    .gt("progress_percent", 2)
    .lt("progress_percent", 90)
    .order("last_watched_at", { ascending: false })
    .limit(clampLimit(limit, 10, 50));

  if (error) {
    if (isMissingTableError(error)) {
      return [];
    }

    throwDatabaseError(error, "Failed to load watch history.");
  }

  return rowsToContinueWatchingItems((data ?? []) as WatchHistoryRow[]);
}

async function listUserMovieIds(table: "movie_likes" | "movie_watchlist", userId: string) {
  const supabase = getOptionalAdminClient();

  if (!supabase) {
    return [] as string[];
  }

  const { data, error } = await supabase.from(table).select("movie_id").eq("user_id", userId);

  if (error) {
    if (isMissingTableError(error)) {
      return [];
    }

    throwDatabaseError(error, "Failed to load recommendation signals.");
  }

  return ((data ?? []) as MovieIdRow[]).map((row) => row.movie_id);
}

async function listUserHistoryRows(userId: string) {
  const supabase = getOptionalAdminClient();

  if (!supabase) {
    return [] as WatchHistoryRow[];
  }

  const { data, error } = await supabase
    .from("watch_history")
    .select("*")
    .eq("user_id", userId)
    .order("last_watched_at", { ascending: false })
    .limit(80);

  if (error) {
    if (isMissingTableError(error)) {
      return [];
    }

    throwDatabaseError(error, "Failed to load recommendation history.");
  }

  return (data ?? []) as WatchHistoryRow[];
}

async function getTrendingCounts() {
  const supabase = getOptionalAdminClient();
  const counts = new Map<string, number>();

  if (!supabase) {
    return counts;
  }

  const since = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString();
  const { data, error } = await supabase
    .from("movie_views")
    .select("movie_id")
    .gte("created_at", since)
    .limit(1000);

  if (error) {
    if (isMissingTableError(error)) {
      return counts;
    }

    throwDatabaseError(error, "Failed to load trending signals.");
  }

  for (const row of (data ?? []) as MovieViewRow[]) {
    counts.set(row.movie_id, (counts.get(row.movie_id) ?? 0) + 1);
  }

  return counts;
}

function addMovieSignals(
  movie: MovieRecord | undefined,
  weights: {
    dubbers: Map<string, number>;
    genres: Map<string, number>;
    types: Map<string, number>;
  },
  amount: number
) {
  if (!movie) {
    return;
  }

  for (const genre of movie.genres) {
    weights.genres.set(genre, (weights.genres.get(genre) ?? 0) + amount);
  }

  if (movie.type) {
    weights.types.set(movie.type, (weights.types.get(movie.type) ?? 0) + amount);
  }

  if (movie.dubberId) {
    weights.dubbers.set(movie.dubberId, (weights.dubbers.get(movie.dubberId) ?? 0) + amount);
  }
}

function chooseReason(flags: {
  likedGenre: boolean;
  newRelease: boolean;
  sameDubber: boolean;
  sameType: boolean;
  trending: boolean;
  watchedGenre: boolean;
}) {
  if (flags.likedGenre) {
    return "Ұнатқан контентіңізге жақын";
  }

  if (flags.watchedGenre) {
    return "Сіз көрген жанрға ұқсас";
  }

  if (flags.sameType) {
    return "Сіз көрген форматқа жақын";
  }

  if (flags.sameDubber) {
    return "Дыбыстаушысы ұқсас";
  }

  if (flags.newRelease) {
    return "Жаңа релиз";
  }

  if (flags.trending) {
    return "Танымал контент";
  }

  return "Танымал контент";
}

function isNewRelease(movie: MovieRecord) {
  const currentYear = new Date().getFullYear();

  return movie.isNewRelease || movie.year >= currentYear - 1 || movie.status === "ongoing";
}

function fallbackScore(movie: MovieRecord, index: number, trendingCount: number) {
  return trendingCount * 2 + (isNewRelease(movie) ? 4 : 0) + Math.max(0, 20 - index) / 20;
}

export async function getRecommendationsForUser(userId: string | null | undefined, limit = 8): Promise<RecommendationResult> {
  const normalizedLimit = clampLimit(limit, 8, 12);
  const movies = (await getAllMovies()) as MovieRecord[];
  const movieById = new Map(movies.map((movie) => [movie.id, movie]));
  const [trendingCounts, historyRows, likedIds, watchlistIds] = await Promise.all([
    getTrendingCounts(),
    userId ? listUserHistoryRows(userId) : Promise.resolve([] as WatchHistoryRow[]),
    userId ? listUserMovieIds("movie_likes", userId) : Promise.resolve([] as string[]),
    userId ? listUserMovieIds("movie_watchlist", userId) : Promise.resolve([] as string[])
  ]);

  const completedIds = new Set(historyRows.filter((row) => row.completed || row.progress_percent >= 90).map((row) => row.content_id));
  const heavilyWatchedIds = new Set(
    historyRows
      .filter((row) => !completedIds.has(row.content_id) && row.progress_percent >= 70)
      .map((row) => row.content_id)
  );
  const watchedIds = new Set(historyRows.filter((row) => row.progress_percent > 2).map((row) => row.content_id));
  const signalIds = new Set([...watchedIds, ...likedIds, ...watchlistIds]);
  const personalized = signalIds.size > 0;

  if (!personalized) {
    const items = movies
      .map((movie, index) => {
        const trendingCount = trendingCounts.get(movie.id) ?? 0;
        const newRelease = isNewRelease(movie);
        const trending = trendingCount > 0;

        return {
          movie,
          reason: newRelease ? "Жаңа релиз" : trending ? "Танымал контент" : "Танымал контент",
          score: fallbackScore(movie, index, trendingCount)
        };
      })
      .sort((left, right) => right.score - left.score)
      .slice(0, normalizedLimit);

    return {
      items,
      personalized: false
    };
  }

  const watchedWeights = {
    dubbers: new Map<string, number>(),
    genres: new Map<string, number>(),
    types: new Map<string, number>()
  };
  const likedWeights = {
    dubbers: new Map<string, number>(),
    genres: new Map<string, number>(),
    types: new Map<string, number>()
  };
  const watchlistWeights = {
    dubbers: new Map<string, number>(),
    genres: new Map<string, number>(),
    types: new Map<string, number>()
  };

  for (const row of historyRows) {
    if (row.progress_percent <= 2) {
      continue;
    }

    addMovieSignals(movieById.get(row.content_id), watchedWeights, row.completed ? 1 : 2);
  }

  for (const id of likedIds) {
    addMovieSignals(movieById.get(id), likedWeights, 2);
  }

  for (const id of watchlistIds) {
    addMovieSignals(movieById.get(id), watchlistWeights, 1);
  }

  const recommendations = new Map<string, RecommendationItem>();

  movies.forEach((movie, index) => {
    let score = fallbackScore(movie, index, trendingCounts.get(movie.id) ?? 0) * 0.2;
    const flags = {
      likedGenre: false,
      newRelease: isNewRelease(movie),
      sameDubber: false,
      sameType: false,
      trending: (trendingCounts.get(movie.id) ?? 0) > 0,
      watchedGenre: false
    };

    for (const genre of movie.genres) {
      const watchedGenreWeight = watchedWeights.genres.get(genre) ?? 0;
      const likedGenreWeight = likedWeights.genres.get(genre) ?? 0;
      const watchlistGenreWeight = watchlistWeights.genres.get(genre) ?? 0;

      if (watchedGenreWeight > 0) {
        score += 5;
        flags.watchedGenre = true;
      }

      if (likedGenreWeight > 0) {
        score += 4;
        flags.likedGenre = true;
      }

      if (watchlistGenreWeight > 0) {
        score += 3;
      }
    }

    if (movie.type) {
      if ((watchedWeights.types.get(movie.type) ?? 0) > 0 || (likedWeights.types.get(movie.type) ?? 0) > 0) {
        score += 3;
        flags.sameType = true;
      }

      if ((watchlistWeights.types.get(movie.type) ?? 0) > 0) {
        score += 2;
        flags.sameType = true;
      }
    }

    if (movie.dubberId) {
      if (
        (watchedWeights.dubbers.get(movie.dubberId) ?? 0) > 0 ||
        (likedWeights.dubbers.get(movie.dubberId) ?? 0) > 0 ||
        (watchlistWeights.dubbers.get(movie.dubberId) ?? 0) > 0
      ) {
        score += 2;
        flags.sameDubber = true;
      }
    }

    if (flags.newRelease) {
      score += 2;
    }

    if (flags.trending) {
      score += 1;
    }

    if (completedIds.has(movie.id)) {
      score -= 10;
    } else if (heavilyWatchedIds.has(movie.id)) {
      score -= 5;
    }

    if (signalIds.has(movie.id)) {
      score -= 3;
    }

    recommendations.set(movie.id, {
      movie,
      reason: chooseReason(flags),
      score
    });
  });

  return {
    items: Array.from(recommendations.values())
      .sort((left, right) => right.score - left.score || left.movie.title.localeCompare(right.movie.title))
      .slice(0, normalizedLimit),
    personalized: true
  };
}
