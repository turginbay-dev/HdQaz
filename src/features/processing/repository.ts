import "server-only";
import { ApiError } from "@/lib/api/errors";
import { getOptionalAdminClient } from "@/lib/supabase/admin";
import type { ProcessingJob, ProcessingJobView, ProcessingStage } from "@/types/processing";
import type { parseList } from "@/features/processing/validation";

function db() {
  const client = getOptionalAdminClient();
  if (!client) throw new ApiError(503, "automation_not_configured", "Automation database is not configured.");
  return client;
}
function databaseError(error: { code?: string }): never {
  // Never pass database error text/details/hints or query arguments into a response/log.
  if (error.code === "23505") throw new ApiError(409, "job_conflict", "An active job or conflicting idempotency key already exists.");
  if (["23503", "23514", "22023", "22P02"].includes(error.code ?? "")) throw new ApiError(400, "invalid_job", "Invalid target, state transition or processing data.");
  if (error.code === "P0001") throw new ApiError(409, "lease_or_state_conflict", "The lease expired, ownership changed, or the job is not retryable.");
  throw new ApiError(503, "queue_unavailable", "The processing queue is temporarily unavailable.");
}
const columns = "id,admin_cancelled_at,content_id,episode_id,status,progress_percent,attempt_count,max_attempts,next_attempt_at,heartbeat_at,lease_expires_at,output_manifest_url,output_metadata,error_code,error_message,created_at,updated_at,started_at,finished_at";
export function jobView(job: ProcessingJob): ProcessingJobView {
  // Explicit serialization prevents credentials/lease tokens/raw payload additions from leaking.
  return { cancelled: job.status === "failed" && Boolean((job as ProcessingJob & {admin_cancelled_at?: string}).admin_cancelled_at), id: job.id, content_id: job.content_id, episode_id: job.episode_id, status: job.status,
    stage: ["downloading", "processing", "uploading"].includes(job.status) ? job.status as ProcessingStage : null,
    progress_percent: job.progress_percent, attempt_count: job.attempt_count, max_attempts: job.max_attempts,
    next_attempt_at: job.next_attempt_at, heartbeat_at: job.heartbeat_at, lease_expires_at: job.lease_expires_at,
    output_manifest_url: job.output_manifest_url, output_metadata: job.output_metadata,
    error_code: job.error_code, error_message: job.error_message,
    created_at: job.created_at, updated_at: job.updated_at, started_at: job.started_at, finished_at: job.finished_at };
}
type RpcName = "automation_create_job" | "automation_claim_job" | "automation_update_job" | "automation_retry_job";
export async function callJob(name: RpcName, args: Record<string, unknown>, claim = false) {
  const { data, error } = await db().rpc(name, args);
  if (error) databaseError(error);
  const row = (data as ProcessingJob[] | null)?.[0];
  if (!row) {
    if (claim) return null;
    throw new ApiError(503, "queue_unavailable", "The processing queue is temporarily unavailable.");
  }
  if (name === "automation_retry_job") {
    const cleared = await db().from("processing_jobs").update({admin_cancelled_at:null,admin_hidden_at:null}).eq("id",row.id).eq("status","queued");
    if(cleared.error)databaseError(cleared.error);
  }
  return claim ? { ...jobView(row), lease_token: row.lease_token } : jobView(row);
}
export async function listJobs(filters: ReturnType<typeof parseList>) {
  const client = db();
  let query = client.from("processing_jobs").select(columns).or("admin_hidden_at.is.null,status.neq.failed").order("created_at", { ascending: false }).order("id", { ascending: false })
    .range(filters.offset, filters.offset + filters.limit);
  if (filters.status) query = query.eq("status", filters.status);
  const { data, error } = await query;
  if (error) databaseError(error);
  const rows = (data ?? []) as unknown as ProcessingJob[];
  const visible = rows.slice(0, filters.limit);
  if (!visible.length) return { items: [], has_more: false };
  const contentIds = [...new Set(visible.map(row => row.content_id))];
  const episodeIds = [...new Set(visible.flatMap(row => row.episode_id ? [row.episode_id] : []))];
  const contents = await client.from("contents").select("id,title").in("id", contentIds);
  if (contents.error) databaseError(contents.error);
  const episodes = episodeIds.length ? await client.from("episodes").select("id,title,episode_number").in("id", episodeIds) : { data: [], error: null };
  if (episodes.error) databaseError(episodes.error);
  const reviews = await client.from("telegram_workflows").select("job_id,state").in("job_id", visible.map(row => row.id));
  // Additive rollout: old deployments remain usable before Phase 4 is installed.
  if (reviews.error && !["42P01", "PGRST205"].includes(reviews.error.code)) databaseError(reviews.error);
  return { has_more: rows.length > filters.limit, items: visible.map(row => ({ ...jobView(row),
    telegram_review_state: reviews.data?.find(review => review.job_id === row.id)?.state ?? null,
    content_title: contents.data?.find(content => content.id === row.content_id)?.title ?? "Content",
    episode_title: episodes.data?.find(episode => episode.id === row.episode_id)?.title ?? null,
    episode_number: episodes.data?.find(episode => episode.id === row.episode_id)?.episode_number })) };
}

export async function cancelJob(id: string) {
  const { data, error } = await db().from("processing_jobs").update({
    admin_cancelled_at: new Date().toISOString(), status: "failed", error_code: "internal_error", finished_at: new Date().toISOString(),
    worker_id: null, lease_token: null, lease_expires_at: null, heartbeat_at: null, next_attempt_at: null
  }).eq("id", id).in("status", ["queued", "downloading", "processing", "uploading"]).select("*").maybeSingle();
  if (error) databaseError(error);
  if (!data) throw new ApiError(409, "state_conflict", "Тапсырма аяқталған немесе күйі өзгерген. Жаңартыңыз.");
  return jobView(data as ProcessingJob);
}

export async function hideJob(id: string) {
 const { data, error } = await db().from("processing_jobs").update({admin_hidden_at:new Date().toISOString()}).eq("id",id).eq("status","failed").select("id").maybeSingle();
 if(error)databaseError(error);
 if(!data)throw new ApiError(409,"state_conflict","Тек аяқталған қате тапсырманы жасыруға болады.");
 return {id};
}
