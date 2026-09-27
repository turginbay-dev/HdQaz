import { ApiError } from "@/lib/api/errors";
import type { ProcessingOutputMetadata, ProcessingStage, ProcessingStatus } from "@/types/processing";

export const statuses: ProcessingStatus[] = ["queued", "downloading", "processing", "uploading", "ready", "failed"];
const stages: ProcessingStage[] = ["downloading", "processing", "uploading"];
const workerErrors = ["download_failed", "invalid_media", "processing_failed", "upload_failed", "internal_error"];
function invalid(message = "Invalid processing request."): never { throw new ApiError(400, "invalid_input", message); }
export function uuid(value: unknown): string {
  if (typeof value !== "string" || !/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value)) invalid("A valid UUID is required.");
  return value.toLowerCase();
}
function fields(body: Record<string, unknown>, allowed: string[]) {
  if (Object.keys(body).some(key => !allowed.includes(key))) invalid("Unsupported request field.");
}
function integer(value: unknown, min: number, max: number): number {
  if (typeof value !== "number" || !Number.isInteger(value) || value < min || value > max) invalid("Integer is outside the allowed range.");
  return value;
}
export function parseCreate(body: Record<string, unknown>) {
  fields(body, ["content_id", "episode_id", "idempotency_key", "max_attempts"]);
  return { p_content_id: uuid(body.content_id), p_episode_id: body.episode_id == null ? null : uuid(body.episode_id),
    p_idempotency_key: uuid(body.idempotency_key), p_max_attempts: body.max_attempts === undefined ? 3 : integer(body.max_attempts, 1, 10) };
}
export function parseClaim(body: Record<string, unknown>) { fields(body, []); }
export function parseHeartbeat(body: Record<string, unknown>) {
  fields(body, ["lease_token", "stage", "progress_percent"]);
  if (!stages.includes(body.stage as ProcessingStage)) invalid("Invalid processing stage.");
  return { p_lease_token: uuid(body.lease_token), p_stage: body.stage as ProcessingStage, p_progress: integer(body.progress_percent, 0, 100) };
}
export function parseMetadata(value: unknown): ProcessingOutputMetadata {
  if (!value || typeof value !== "object" || Array.isArray(value)) invalid("Output metadata must be an object.");
  const metadata = value as Record<string, unknown>;
  fields(metadata, ["duration_seconds", "width", "height", "size_bytes"]);
  for (const [key, number] of Object.entries(metadata)) {
    if (typeof number !== "number" || !Number.isFinite(number) || number <= 0 || number > Number.MAX_SAFE_INTEGER) invalid("Invalid output measurement.");
    if (key === "duration_seconds") { if (number > 604800) invalid("Duration exceeds the supported range."); }
    else integer(number, 1, key === "size_bytes" ? Number.MAX_SAFE_INTEGER : 16384);
  }
  return metadata as ProcessingOutputMetadata;
}
export function manifestUrl(value: unknown, origins: string): string {
  // No fetching: only a public manifest reference is stored for human review.
  if (!origins.trim()) throw new ApiError(503, "automation_not_configured", "Output destinations are not configured.");
  if (typeof value !== "string" || value.length > 2048) invalid("Invalid manifest URL.");
  let url: URL;
  try { url = new URL(value); } catch { return invalid("Invalid manifest URL."); }
  const allowed = origins.split(",").map(origin => origin.trim());
  if (allowed.some(origin => { try { const u = new URL(origin); return u.protocol !== "https:" || u.origin !== origin || Boolean(u.port || u.username || u.password); } catch { return true; } })) {
    throw new ApiError(503, "automation_not_configured", "Output destinations are not configured.");
  }
  if (url.protocol !== "https:" || !allowed.includes(url.origin) || url.username || url.password || url.port || url.search || url.hash
      || url.href !== value || !/^(\/[A-Za-z0-9._~-]+)+\.m3u8$/.test(url.pathname)) invalid("Manifest must be a public HTTPS .m3u8 URL on an approved destination, without credentials or query parameters.");
  return url.href;
}
export function parseComplete(body: Record<string, unknown>, origins: string) {
  fields(body, ["lease_token", "output_manifest_url", "output_metadata"]);
  return { p_lease_token: uuid(body.lease_token), p_manifest: manifestUrl(body.output_manifest_url, origins),
    p_metadata: parseMetadata(body.output_metadata ?? {}) };
}
export function parseFail(body: Record<string, unknown>) {
  // Raw messages/stacks/URLs are deliberately rejected, never sanitized by guessing.
  fields(body, ["lease_token", "error_code"]);
  if (!workerErrors.includes(body.error_code as string)) invalid("Invalid worker error code.");
  return { p_lease_token: uuid(body.lease_token), p_error_code: body.error_code as string };
}
export function parseList(url: URL) {
  for (const key of url.searchParams.keys()) if (!["status", "limit", "offset"].includes(key)) invalid();
  const status = url.searchParams.get("status");
  if (status && !statuses.includes(status as ProcessingStatus)) invalid("Invalid job status.");
  return { status: status as ProcessingStatus | null,
    limit: integer(Number(url.searchParams.get("limit") ?? 25), 1, 50),
    offset: integer(Number(url.searchParams.get("offset") ?? 0), 0, 100000) };
}
