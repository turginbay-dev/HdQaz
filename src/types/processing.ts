/** Server-owned queue. No browser Supabase access or credentials. */
export type ProcessingStatus = "queued" | "downloading" | "processing" | "uploading" | "ready" | "failed";
export type ProcessingErrorCode = "download_failed" | "invalid_media" | "processing_failed" | "upload_failed" | "lease_expired" | "internal_error";
export type ProcessingStage = "downloading" | "processing" | "uploading";
export type ProcessingOutputMetadata = { duration_seconds?: number; width?: number; height?: number; size_bytes?: number };
export type ProcessingJob = {
  id: string;
  content_id: string;
  episode_id: string | null;
  status: ProcessingStatus;
  progress_percent: number;
  idempotency_key: string;
  attempt_count: number;
  max_attempts: number;
  next_attempt_at: string | null;
  worker_id: string | null;
  lease_token: string | null;
  lease_expires_at: string | null;
  heartbeat_at: string | null;
  output_manifest_url: string | null;
  output_metadata: ProcessingOutputMetadata;
  error_code: ProcessingErrorCode | null;
  error_message: string | null;
  created_at: string;
  updated_at: string;
  started_at: string | null;
  finished_at: string | null;
};

/** Safe admin/worker view. The per-claim secret is returned only by claim. */
export type ProcessingJobView = Pick<ProcessingJob,
  "id" | "content_id" | "episode_id" | "status" | "progress_percent" | "attempt_count" | "max_attempts" |
  "next_attempt_at" | "heartbeat_at" | "lease_expires_at" | "output_manifest_url" | "output_metadata" |
  "error_code" | "error_message" | "created_at" | "updated_at" | "started_at" | "finished_at"
> & { telegram_review_state?: string | null; stage: ProcessingStage | null; content_title?: string; episode_title?: string | null; episode_number?: number };
