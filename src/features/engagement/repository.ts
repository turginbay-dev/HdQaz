import { ApiError } from "@/lib/api/errors";
import { getOptionalAdminClient } from "@/lib/supabase/admin";
import type { EngagementState, EngagementStats, MovieComment, PublicProfileSummary } from "@/features/engagement/types";

type ContentSlugRow = {
  id: string;
  slug: string;
};

type CommentRow = {
  id: string;
  user_id: string;
  movie_id: string;
  parent_id: string | null;
  body: string;
  is_spoiler: boolean;
  is_hidden: boolean;
  hidden_reason: string | null;
  deleted_at: string | null;
  created_at: string;
  updated_at: string;
};

type ProfileRow = {
  id: string;
  display_name: string | null;
  avatar_url: string | null;
  default_avatar_key: string | null;
};

const fallbackDisplayName = "HdQaz қолданушысы";
const viewWindowHours = 6;

function requireDatabase() {
  const supabase = getOptionalAdminClient();

  if (!supabase) {
    throw new ApiError(
      503,
      "database_not_configured",
      "Engagement writes require NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY."
    );
  }

  return supabase;
}

function throwDatabaseError(error: { code?: string; message: string }, fallback: string): never {
  if (error.code === "23505") {
    throw new ApiError(409, "conflict", "This engagement item already exists.");
  }

  throw new ApiError(500, "database_error", fallback, error.message);
}

function normalizeDisplayName(value?: string | null) {
  const trimmed = value?.trim();

  return trimmed && trimmed.length >= 2 ? trimmed : fallbackDisplayName;
}

function profileSummary(row?: ProfileRow): PublicProfileSummary {
  return {
    id: row?.id ?? "",
    avatarUrl: row?.avatar_url ?? null,
    defaultAvatarKey: row?.default_avatar_key ?? "hdqaz",
    displayName: normalizeDisplayName(row?.display_name)
  };
}

function rowToComment(row: CommentRow, profile: ProfileRow | undefined, options: { canSeeHiddenBody: boolean }): MovieComment {
  return {
    id: row.id,
    movieId: row.movie_id,
    userId: row.user_id,
    parentId: row.parent_id,
    body: row.is_hidden && !options.canSeeHiddenBody ? "" : row.body,
    isSpoiler: row.is_spoiler,
    isHidden: row.is_hidden,
    hiddenReason: row.hidden_reason,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    author: {
      ...profileSummary(profile),
      id: row.user_id
    }
  };
}

export async function getContentIdBySlug(slug: string) {
  const supabase = getOptionalAdminClient();

  if (!supabase) {
    return null;
  }

  const { data, error } = await supabase.from("contents").select("id, slug").eq("slug", slug).maybeSingle();

  if (error) {
    throwDatabaseError(error, "Failed to load movie.");
  }

  return data as ContentSlugRow | null;
}

async function requireContentBySlug(slug: string) {
  const content = await getContentIdBySlug(slug);

  if (!content) {
    throw new ApiError(404, "movie_not_found", "Movie not found.");
  }

  return content;
}

export async function getEngagementState(userId: string | null | undefined, movieId: string): Promise<EngagementState> {
  const supabase = getOptionalAdminClient();

  if (!supabase || !userId) {
    return {
      isLiked: false,
      isWatchlisted: false
    };
  }

  const [likeResult, watchlistResult] = await Promise.all([
    supabase.from("movie_likes").select("id").eq("user_id", userId).eq("movie_id", movieId).maybeSingle(),
    supabase.from("movie_watchlist").select("id").eq("user_id", userId).eq("movie_id", movieId).maybeSingle()
  ]);

  if (likeResult.error && likeResult.error.code !== "PGRST116") {
    throwDatabaseError(likeResult.error, "Failed to load like state.");
  }

  if (watchlistResult.error && watchlistResult.error.code !== "PGRST116") {
    throwDatabaseError(watchlistResult.error, "Failed to load watchlist state.");
  }

  return {
    isLiked: Boolean(likeResult.data),
    isWatchlisted: Boolean(watchlistResult.data)
  };
}

export async function addMovieLike(userId: string, movieSlug: string) {
  const supabase = requireDatabase();
  const content = await requireContentBySlug(movieSlug);
  const { error } = await supabase
    .from("movie_likes")
    .upsert({ user_id: userId, movie_id: content.id }, { onConflict: "user_id,movie_id" });

  if (error) {
    throwDatabaseError(error, "Failed to save like.");
  }

  return {
    movieId: content.id,
    movieSlug: content.slug,
    isLiked: true
  };
}

export async function removeMovieLike(userId: string, movieSlug: string) {
  const supabase = requireDatabase();
  const content = await requireContentBySlug(movieSlug);
  const { error } = await supabase.from("movie_likes").delete().eq("user_id", userId).eq("movie_id", content.id);

  if (error) {
    throwDatabaseError(error, "Failed to remove like.");
  }

  return {
    movieId: content.id,
    movieSlug: content.slug,
    isLiked: false
  };
}

export async function listMovieComments(movieId: string, options: { isAdmin?: boolean } = {}) {
  const supabase = getOptionalAdminClient();

  if (!supabase) {
    return [] as MovieComment[];
  }

  const { data, error } = await supabase
    .from("movie_comments")
    .select("*")
    .eq("movie_id", movieId)
    .is("deleted_at", null)
    .order("created_at", { ascending: false });

  if (error) {
    throwDatabaseError(error, "Failed to load comments.");
  }

  const rows = (data ?? []) as CommentRow[];
  const userIds = Array.from(new Set(rows.map((row) => row.user_id)));
  const profilesResult = userIds.length > 0
    ? await supabase.from("user_profiles").select("id, display_name, avatar_url, default_avatar_key").in("id", userIds)
    : { data: [], error: null };

  if (profilesResult.error) {
    throwDatabaseError(profilesResult.error, "Failed to load comment profiles.");
  }

  const profiles = new Map(((profilesResult.data ?? []) as ProfileRow[]).map((row) => [row.id, row]));

  return rows.map((row) => rowToComment(row, profiles.get(row.user_id), { canSeeHiddenBody: Boolean(options.isAdmin) }));
}

export async function createMovieComment(input: {
  body: string;
  isSpoiler: boolean;
  movieSlug: string;
  userId: string;
}) {
  const supabase = requireDatabase();
  const content = await requireContentBySlug(input.movieSlug);
  const duplicateSince = new Date(Date.now() - 30_000).toISOString();

  const { data: recent, error: recentError } = await supabase
    .from("movie_comments")
    .select("id, body")
    .eq("user_id", input.userId)
    .eq("movie_id", content.id)
    .is("deleted_at", null)
    .gte("created_at", duplicateSince)
    .order("created_at", { ascending: false })
    .limit(3);

  if (recentError) {
    throwDatabaseError(recentError, "Failed to validate comment.");
  }

  const normalizedBody = input.body.trim().toLowerCase();
  const duplicate = ((recent ?? []) as Array<{ body: string }>).some((item) => item.body.trim().toLowerCase() === normalizedBody);

  if (duplicate) {
    throw new ApiError(429, "duplicate_comment", "Please wait before posting the same comment again.");
  }

  const { data, error } = await supabase
    .from("movie_comments")
    .insert({
      user_id: input.userId,
      movie_id: content.id,
      body: input.body,
      is_spoiler: input.isSpoiler
    })
    .select("*")
    .single();

  if (error) {
    throwDatabaseError(error, "Failed to create comment.");
  }

  const profileResult = await supabase
    .from("user_profiles")
    .select("id, display_name, avatar_url, default_avatar_key")
    .eq("id", input.userId)
    .maybeSingle();

  if (profileResult.error) {
    throwDatabaseError(profileResult.error, "Failed to load comment profile.");
  }

  return rowToComment(data as CommentRow, profileResult.data as ProfileRow | undefined, { canSeeHiddenBody: false });
}

export async function softDeleteComment(commentId: string, actor: { isAdmin: boolean; userId: string }) {
  const supabase = requireDatabase();
  const query = supabase
    .from("movie_comments")
    .update({ deleted_at: new Date().toISOString() })
    .eq("id", commentId)
    .is("deleted_at", null);

  const { data, error } = await (actor.isAdmin ? query : query.eq("user_id", actor.userId)).select("id").maybeSingle();

  if (error) {
    throwDatabaseError(error, "Failed to delete comment.");
  }

  if (!data) {
    throw new ApiError(404, "comment_not_found", "Comment not found.");
  }
}

export async function moderateComment(commentId: string, action: "hide" | "restore" | "mark_spoiler" | "remove_spoiler", hiddenReason?: string) {
  const supabase = requireDatabase();
  const patch =
    action === "hide"
      ? { is_hidden: true, hidden_reason: hiddenReason || "Модерация" }
      : action === "restore"
        ? { is_hidden: false, hidden_reason: null }
        : action === "mark_spoiler"
          ? { is_spoiler: true }
          : { is_spoiler: false };

  const { data, error } = await supabase
    .from("movie_comments")
    .update(patch)
    .eq("id", commentId)
    .is("deleted_at", null)
    .select("*")
    .maybeSingle();

  if (error) {
    throwDatabaseError(error, "Failed to moderate comment.");
  }

  if (!data) {
    throw new ApiError(404, "comment_not_found", "Comment not found.");
  }

  const row = data as CommentRow;
  const profileResult = await supabase
    .from("user_profiles")
    .select("id, display_name, avatar_url, default_avatar_key")
    .eq("id", row.user_id)
    .maybeSingle();

  if (profileResult.error) {
    throwDatabaseError(profileResult.error, "Failed to load comment profile.");
  }

  return rowToComment(row, profileResult.data as ProfileRow | undefined, { canSeeHiddenBody: true });
}

async function countMovieRows(
  table: "movie_comments" | "movie_likes" | "movie_views" | "movie_watchlist",
  movieId: string,
  options: { activeCommentsOnly?: boolean } = {}
) {
  const supabase = getOptionalAdminClient();

  if (!supabase) {
    return 0;
  }

  let query = supabase.from(table).select("id", { count: "exact", head: true }).eq("movie_id", movieId);

  if (table === "movie_comments" && options.activeCommentsOnly) {
    query = query.is("deleted_at", null);
  }

  const { count, error } = await query;

  if (error) {
    throwDatabaseError(error, "Failed to count engagement.");
  }

  return count ?? 0;
}

export async function getMovieViewCount(movieId: string) {
  return countMovieRows("movie_views", movieId);
}

export async function getMovieEngagementStats(movieId: string): Promise<EngagementStats> {
  const [views, likes, watchlist, comments] = await Promise.all([
    countMovieRows("movie_views", movieId),
    countMovieRows("movie_likes", movieId),
    countMovieRows("movie_watchlist", movieId),
    countMovieRows("movie_comments", movieId, { activeCommentsOnly: true })
  ]);

  return {
    comments,
    likes,
    views,
    watchlist
  };
}

export async function recordMovieView(input: {
  movieSlug: string;
  sessionId?: string;
  userId?: string | null;
}) {
  const supabase = requireDatabase();
  const content = await requireContentBySlug(input.movieSlug);
  const since = new Date(Date.now() - viewWindowHours * 60 * 60 * 1000).toISOString();
  let recentQuery = supabase
    .from("movie_views")
    .select("id")
    .eq("movie_id", content.id)
    .gte("created_at", since)
    .limit(1);

  if (input.userId) {
    recentQuery = recentQuery.eq("user_id", input.userId);
  } else if (input.sessionId) {
    recentQuery = recentQuery.eq("session_id", input.sessionId);
  } else {
    throw new ApiError(400, "missing_view_identity", "A user or session id is required.");
  }

  const { data: recent, error: recentError } = await recentQuery;

  if (recentError) {
    throwDatabaseError(recentError, "Failed to validate view.");
  }

  if ((recent ?? []).length > 0) {
    return {
      counted: false,
      movieId: content.id
    };
  }

  const { error } = await supabase.from("movie_views").insert({
    movie_id: content.id,
    user_id: input.userId ?? null,
    session_id: input.userId ? null : input.sessionId ?? null
  });

  if (error) {
    throwDatabaseError(error, "Failed to record view.");
  }

  return {
    counted: true,
    movieId: content.id
  };
}

export async function listUserMovieIds(table: "movie_likes" | "movie_watchlist", userId: string) {
  const supabase = getOptionalAdminClient();

  if (!supabase) {
    return [] as string[];
  }

  const { data, error } = await supabase.from(table).select("movie_id").eq("user_id", userId).order("created_at", { ascending: false });

  if (error) {
    throwDatabaseError(error, "Failed to load user engagement.");
  }

  return ((data ?? []) as Array<{ movie_id: string }>).map((row) => row.movie_id);
}

export async function listUserComments(userId: string, limit = 20) {
  const supabase = getOptionalAdminClient();

  if (!supabase) {
    return [] as Array<MovieComment & { movieSlug?: string; movieTitle?: string }>;
  }

  const { data, error } = await supabase
    .from("movie_comments")
    .select("*")
    .eq("user_id", userId)
    .is("deleted_at", null)
    .order("created_at", { ascending: false })
    .limit(limit);

  if (error) {
    throwDatabaseError(error, "Failed to load user comments.");
  }

  const rows = (data ?? []) as CommentRow[];
  const movieIds = Array.from(new Set(rows.map((row) => row.movie_id)));
  const { data: movies, error: moviesError } = movieIds.length > 0
    ? await supabase.from("contents").select("id, slug, title").in("id", movieIds)
    : { data: [], error: null };

  if (moviesError) {
    throwDatabaseError(moviesError, "Failed to load comment movies.");
  }

  const movieById = new Map(((movies ?? []) as Array<{ id: string; slug: string; title: string }>).map((movie) => [movie.id, movie]));

  return rows.map((row) => {
    const movie = movieById.get(row.movie_id);

    return {
      ...rowToComment(row, undefined, { canSeeHiddenBody: true }),
      movieSlug: movie?.slug,
      movieTitle: movie?.title
    };
  });
}
