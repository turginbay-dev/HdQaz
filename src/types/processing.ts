/** Server-owned queue. No browser Supabase access or credentials. */
export type ProcessingStatus = "queued" | "downloading" | "processing" | "uploading" | "ready" | "failed";
export type ProcessingErrorCode = "download_failed" | "invalid_media" | "processing_failed" | "upload_failed" | "lease_expired" | "internal_error";
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
  error_code: ProcessingErrorCode | null;
  error_message: string | null;
  created_at: string;
  updated_at: string;
  started_at: string | null;
  finished_at: string | null;
};
