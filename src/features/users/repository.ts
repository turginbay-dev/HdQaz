import type { User } from "@supabase/supabase-js";
import { ApiError } from "@/lib/api/errors";
import { getOptionalAdminClient } from "@/lib/supabase/admin";
import type { UserProfile, WatchProgress, WatchlistItem } from "@/types/backend";

type ProfileRow = {
  id: string;
  email: string | null;
  display_name: string | null;
  avatar_url: string | null;
  role: "user" | "admin";
  created_at: string;
  updated_at: string;
};

type WatchlistRow = {
  user_id: string;
  movie_slug: string;
  created_at: string;
};

type WatchProgressRow = {
  user_id: string;
  movie_slug: string;
  position_seconds: number;
  duration_seconds: number;
  percent: number;
  completed: boolean;
  updated_at: string;
};

function requireDatabase() {
  const supabase = getOptionalAdminClient();

  if (!supabase) {
    throw new ApiError(
      503,
      "database_not_configured",
      "User writes require NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY."
    );
  }

  return supabase;
}

function profileFromUser(user: User): UserProfile {
  return {
    id: user.id,
    email: user.email,
    displayName:
      (user.user_metadata?.full_name as string | undefined) ??
      (user.user_metadata?.name as string | undefined) ??
      user.email?.split("@")[0] ??
      "HdQaz қолданушысы",
    avatarUrl: user.user_metadata?.avatar_url as string | undefined,
    role: "user"
  };
}

function rowToProfile(row: ProfileRow): UserProfile {
  return {
    id: row.id,
    email: row.email,
    displayName: row.display_name,
    avatarUrl: row.avatar_url,
    role: row.role,
    createdAt: row.created_at,
    updatedAt: row.updated_at
  };
}

function rowToWatchlist(row: WatchlistRow): WatchlistItem {
  return {
    userId: row.user_id,
    movieSlug: row.movie_slug,
    createdAt: row.created_at
  };
}

function rowToProgress(row: WatchProgressRow): WatchProgress {
  return {
    userId: row.user_id,
    movieSlug: row.movie_slug,
    positionSeconds: row.position_seconds,
    durationSeconds: row.duration_seconds,
    percent: row.percent,
    completed: row.completed,
    updatedAt: row.updated_at
  };
}

function throwDatabaseError(error: { code?: string; message: string }, fallback: string): never {
  if (error.code === "23505") {
    throw new ApiError(409, "conflict", "This item already exists.");
  }

  throw new ApiError(500, "database_error", fallback, error.message);
}

export async function getOrCreateProfile(user: User) {
  const supabase = getOptionalAdminClient();
  const fallback = profileFromUser(user);

  if (!supabase) {
    return fallback;
  }

  const { data, error } = await supabase
    .from("profiles")
    .upsert(
      {
        id: user.id,
        email: user.email ?? null,
        display_name: fallback.displayName ?? null,
        avatar_url: fallback.avatarUrl ?? null
      },
      { onConflict: "id" }
    )
    .select("*")
    .single();

  if (error) {
    throwDatabaseError(error, "Failed to load profile.");
  }

  return rowToProfile(data as ProfileRow);
}

export async function updateProfile(userId: string, patch: { displayName?: string; avatarUrl?: string | null }) {
  const supabase = requireDatabase();
  const update = {
    ...(patch.displayName ? { display_name: patch.displayName } : {}),
    ...(patch.avatarUrl !== undefined ? { avatar_url: patch.avatarUrl } : {})
  };

  if (Object.keys(update).length === 0) {
    throw new ApiError(400, "empty_patch", "At least one field is required.");
  }

  const { data, error } = await supabase.from("profiles").update(update).eq("id", userId).select("*").single();

  if (error) {
    throwDatabaseError(error, "Failed to update profile.");
  }

  return rowToProfile(data as ProfileRow);
}

export async function listWatchlist(userId: string) {
  const supabase = getOptionalAdminClient();

  if (!supabase) {
    return [] as WatchlistItem[];
  }

  const { data, error } = await supabase
    .from("watchlist_items")
    .select("*")
    .eq("user_id", userId)
    .order("created_at", { ascending: false });

  if (error) {
    throwDatabaseError(error, "Failed to load watchlist.");
  }

  return ((data ?? []) as WatchlistRow[]).map(rowToWatchlist);
}

export async function addWatchlistItem(userId: string, movieSlug: string) {
  const supabase = requireDatabase();
  const { data, error } = await supabase
    .from("watchlist_items")
    .insert({
      user_id: userId,
      movie_slug: movieSlug
    })
    .select("*")
    .single();

  if (error) {
    throwDatabaseError(error, "Failed to add watchlist item.");
  }

  return rowToWatchlist(data as WatchlistRow);
}

export async function removeWatchlistItem(userId: string, movieSlug: string) {
  const supabase = requireDatabase();
  const { error } = await supabase.from("watchlist_items").delete().eq("user_id", userId).eq("movie_slug", movieSlug);

  if (error) {
    throwDatabaseError(error, "Failed to remove watchlist item.");
  }
}

export async function listWatchProgress(userId: string, movieSlug?: string) {
  const supabase = getOptionalAdminClient();

  if (!supabase) {
    return [] as WatchProgress[];
  }

  let query = supabase.from("watch_progress").select("*").eq("user_id", userId).order("updated_at", { ascending: false });

  if (movieSlug) {
    query = query.eq("movie_slug", movieSlug);
  }

  const { data, error } = await query;

  if (error) {
    throwDatabaseError(error, "Failed to load watch progress.");
  }

  return ((data ?? []) as WatchProgressRow[]).map(rowToProgress);
}

export async function upsertWatchProgress(
  userId: string,
  input: {
    movieSlug: string;
    positionSeconds: number;
    durationSeconds: number;
    completed?: boolean;
  }
) {
  const supabase = requireDatabase();
  const percent = Math.min(100, Math.max(0, Math.round((input.positionSeconds / input.durationSeconds) * 100)));
  const completed = input.completed ?? percent >= 95;
  const { data, error } = await supabase
    .from("watch_progress")
    .upsert(
      {
        user_id: userId,
        movie_slug: input.movieSlug,
        position_seconds: Math.round(input.positionSeconds),
        duration_seconds: Math.round(input.durationSeconds),
        percent,
        completed
      },
      { onConflict: "user_id,movie_slug" }
    )
    .select("*")
    .single();

  if (error) {
    throwDatabaseError(error, "Failed to save watch progress.");
  }

  return rowToProgress(data as WatchProgressRow);
}
