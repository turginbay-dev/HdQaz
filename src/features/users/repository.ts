import type { User } from "@supabase/supabase-js";
import { ApiError } from "@/lib/api/errors";
import { getOptionalAdminClient } from "@/lib/supabase/admin";
import type { UserProfile, UserSubscriptionStatus, WatchProgress, WatchlistItem } from "@/types/backend";

type ProfileRow = {
  id: string;
  display_name: string | null;
  avatar_url: string | null;
  default_avatar_key: string | null;
  role: "user" | "admin";
  is_admin: boolean;
  created_at: string;
  updated_at: string;
};

type WatchlistRow = {
  id: string;
  user_id: string;
  movie_id: string;
  created_at: string;
};

type ContentSlugRow = {
  id: string;
  slug: string;
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

type SubscriptionRow = {
  plan: "free" | "premium";
  status: "inactive" | "active" | "trialing" | "past_due" | "canceled";
  starts_at: string | null;
  ends_at: string | null;
};

const fallbackDisplayName = "HdQaz қолданушысы";

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
  const metadataName =
    (user.user_metadata?.full_name as string | undefined) ??
    (user.user_metadata?.name as string | undefined);

  return {
    id: user.id,
    email: user.email,
    displayName: metadataName ?? fallbackDisplayName,
    avatarUrl: user.user_metadata?.avatar_url as string | undefined,
    defaultAvatarKey: "hdqaz",
    role: "user",
    isAdmin: false
  };
}

function normalizeDisplayName(value?: string | null) {
  const trimmed = value?.trim();

  return trimmed && trimmed.length >= 2 ? trimmed : fallbackDisplayName;
}

function rowToProfile(row: ProfileRow, email?: string | null): UserProfile {
  return {
    id: row.id,
    email,
    displayName: normalizeDisplayName(row.display_name),
    avatarUrl: row.avatar_url,
    defaultAvatarKey: row.default_avatar_key ?? "hdqaz",
    role: row.is_admin ? "admin" : row.role,
    isAdmin: row.is_admin || row.role === "admin",
    createdAt: row.created_at,
    updatedAt: row.updated_at
  };
}

function rowToWatchlist(row: WatchlistRow, slug: string): WatchlistItem {
  return {
    userId: row.user_id,
    movieId: row.movie_id,
    movieSlug: slug,
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

  const existing = await supabase
    .from("user_profiles")
    .select("*")
    .eq("id", user.id)
    .maybeSingle();

  if (existing.error) {
    throwDatabaseError(existing.error, "Failed to load profile.");
  }

  if (existing.data) {
    return rowToProfile(existing.data as ProfileRow, user.email);
  }

  const { data, error } = await supabase
    .from("user_profiles")
    .insert({
      id: user.id,
      display_name: fallback.displayName ?? null,
      avatar_url: fallback.avatarUrl ?? null,
      default_avatar_key: "hdqaz"
    })
    .select("*")
    .single();

  if (error) {
    throwDatabaseError(error, "Failed to create profile.");
  }

  return rowToProfile(data as ProfileRow, user.email);
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

  const { data, error } = await supabase.from("user_profiles").update(update).eq("id", userId).select("*").single();

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
    .from("movie_watchlist")
    .select("*")
    .eq("user_id", userId)
    .order("created_at", { ascending: false });

  if (error) {
    throwDatabaseError(error, "Failed to load watchlist.");
  }

  const rows = (data ?? []) as WatchlistRow[];
  const movieIds = rows.map((row) => row.movie_id);
  const contentResult = movieIds.length > 0
    ? await supabase.from("contents").select("id, slug").in("id", movieIds)
    : { data: [], error: null };

  if (contentResult.error) {
    throwDatabaseError(contentResult.error, "Failed to load watchlist movies.");
  }

  const slugById = new Map(((contentResult.data ?? []) as ContentSlugRow[]).map((row) => [row.id, row.slug]));

  return rows
    .map((row) => {
      const slug = slugById.get(row.movie_id);

      return slug ? rowToWatchlist(row, slug) : null;
    })
    .filter((item): item is WatchlistItem => Boolean(item));
}

export async function addWatchlistItem(userId: string, movieSlug: string) {
  const supabase = requireDatabase();
  const content = await getContentSlugBySlug(movieSlug);

  if (!content) {
    throw new ApiError(404, "movie_not_found", "Movie not found.");
  }

  const { data, error } = await supabase
    .from("movie_watchlist")
    .insert({
      user_id: userId,
      movie_id: content.id
    })
    .select("*")
    .single();

  if (error) {
    throwDatabaseError(error, "Failed to add watchlist item.");
  }

  return rowToWatchlist(data as WatchlistRow, content.slug);
}

export async function removeWatchlistItem(userId: string, movieSlug: string) {
  const supabase = requireDatabase();
  const content = await getContentSlugBySlug(movieSlug);

  if (!content) {
    return;
  }

  const { error } = await supabase.from("movie_watchlist").delete().eq("user_id", userId).eq("movie_id", content.id);

  if (error) {
    throwDatabaseError(error, "Failed to remove watchlist item.");
  }
}

export async function getContentSlugBySlug(slug: string) {
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

export async function getUserPremiumStatus(userId?: string | null): Promise<UserSubscriptionStatus> {
  if (!userId) {
    return {
      isPremium: false,
      plan: "free",
      status: "inactive"
    };
  }

  const supabase = getOptionalAdminClient();

  if (!supabase) {
    return {
      isPremium: false,
      plan: "free",
      status: "inactive"
    };
  }

  const { data, error } = await supabase
    .from("user_subscriptions")
    .select("plan, status, starts_at, ends_at")
    .eq("user_id", userId)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (error) {
    throwDatabaseError(error, "Failed to load subscription.");
  }

  const subscription = data as SubscriptionRow | null;
  const isActive =
    subscription?.plan === "premium" &&
    (subscription.status === "active" || subscription.status === "trialing") &&
    (!subscription.ends_at || new Date(subscription.ends_at).getTime() > Date.now());

  return {
    isPremium: Boolean(isActive),
    plan: isActive ? "premium" : "free",
    status: subscription?.status ?? "inactive",
    startsAt: subscription?.starts_at ?? null,
    endsAt: subscription?.ends_at ?? null
  };
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
