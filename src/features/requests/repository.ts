import { ApiError } from "@/lib/api/errors";
import { getOptionalAdminClient } from "@/lib/supabase/admin";
import type { ContentRequest, ContentRequestStatus } from "@/types/backend";

type ContentRequestRow = {
  id: string;
  title: string;
  original_title: string | null;
  note: string | null;
  status: ContentRequestStatus;
  votes: number;
  target_votes: number;
  created_by: string | null;
  created_at: string;
  updated_at: string;
};

type CreateContentRequestInput = {
  title: string;
  originalTitle?: string;
  note?: string;
  targetVotes?: number;
  createdBy?: string | null;
};

const seedRequests: ContentRequest[] = [
  {
    id: "interstellar-dub",
    title: "Interstellar",
    status: "requested",
    votes: 28,
    targetVotes: 40
  },
  {
    id: "dune-subtitles",
    title: "Dune: Part Two",
    status: "in_progress",
    votes: 8,
    targetVotes: 10
  },
  {
    id: "inside-out-2",
    title: "Inside Out 2",
    status: "requested",
    votes: 17,
    targetVotes: 40
  }
];

function requireDatabase() {
  const supabase = getOptionalAdminClient();

  if (!supabase) {
    throw new ApiError(
      503,
      "database_not_configured",
      "Request writes require NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY."
    );
  }

  return supabase;
}

function rowToRequest(row: ContentRequestRow): ContentRequest {
  return {
    id: row.id,
    title: row.title,
    originalTitle: row.original_title,
    note: row.note,
    status: row.status,
    votes: row.votes,
    targetVotes: row.target_votes,
    createdBy: row.created_by,
    createdAt: row.created_at,
    updatedAt: row.updated_at
  };
}

function throwDatabaseError(error: { code?: string; message: string }, fallback: string): never {
  if (error.code === "23505") {
    throw new ApiError(409, "conflict", "This request already exists or was already voted on.");
  }

  throw new ApiError(500, "database_error", fallback, error.message);
}

export async function listContentRequests(filters: { q?: string; status?: ContentRequestStatus } = {}) {
  const supabase = getOptionalAdminClient();

  if (!supabase) {
    const query = filters.q?.toLowerCase();

    return seedRequests.filter((request) => {
      const matchesStatus = !filters.status || request.status === filters.status;
      const matchesQuery = !query || [request.title, request.originalTitle, request.note].join(" ").toLowerCase().includes(query);

      return matchesStatus && matchesQuery;
    });
  }

  let query = supabase.from("content_requests").select("*").order("votes", { ascending: false });

  if (filters.status) {
    query = query.eq("status", filters.status);
  }

  const { data, error } = await query;

  if (error) {
    throwDatabaseError(error, "Failed to load content requests.");
  }

  const requests = ((data ?? []) as ContentRequestRow[]).map(rowToRequest);
  const search = filters.q?.trim().toLowerCase();

  if (!search) {
    return requests;
  }

  return requests.filter((request) =>
    [request.title, request.originalTitle, request.note].join(" ").toLowerCase().includes(search)
  );
}

export async function createContentRequest(input: CreateContentRequestInput) {
  const supabase = requireDatabase();
  const { data, error } = await supabase
    .from("content_requests")
    .insert({
      title: input.title,
      original_title: input.originalTitle ?? null,
      note: input.note ?? null,
      target_votes: input.targetVotes ?? 40,
      created_by: input.createdBy ?? null
    })
    .select("*")
    .single();

  if (error) {
    throwDatabaseError(error, "Failed to create content request.");
  }

  return rowToRequest(data as ContentRequestRow);
}

export async function voteForRequest(requestId: string, userId: string) {
  const supabase = requireDatabase();
  const { error } = await supabase.from("request_votes").insert({
    request_id: requestId,
    user_id: userId
  });

  if (error) {
    if (error.code === "23505") {
      throw new ApiError(409, "already_voted", "You already voted for this request.");
    }

    throwDatabaseError(error, "Failed to vote for content request.");
  }

  return getContentRequest(requestId);
}

export async function removeRequestVote(requestId: string, userId: string) {
  const supabase = requireDatabase();
  const { error } = await supabase.from("request_votes").delete().eq("request_id", requestId).eq("user_id", userId);

  if (error) {
    throwDatabaseError(error, "Failed to remove request vote.");
  }

  return getContentRequest(requestId);
}

export async function getContentRequest(requestId: string) {
  const supabase = getOptionalAdminClient();

  if (!supabase) {
    return seedRequests.find((request) => request.id === requestId) ?? null;
  }

  const { data, error } = await supabase.from("content_requests").select("*").eq("id", requestId).maybeSingle();

  if (error) {
    throwDatabaseError(error, "Failed to load content request.");
  }

  return data ? rowToRequest(data as ContentRequestRow) : null;
}
