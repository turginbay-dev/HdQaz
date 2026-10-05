import "server-only";
import { ApiError, isApiError } from "@/lib/api/errors";
import { requireAdmin } from "@/lib/api/auth";
import { isProducer, requireSameOrigin, requireWorker } from "@/features/processing/auth";
import { callJob, listJobs, cancelJob, hideJob } from "@/features/processing/repository";
import { parseClaim, parseComplete, parseCreate, parseFail, parseHeartbeat, parseList, uuid } from "@/features/processing/validation";

const headers = { "Cache-Control": "no-store", Vary: "Authorization, Cookie" };
async function body(request: Request): Promise<Record<string, unknown>> {
  if (request.headers.get("content-type")?.split(";")[0].trim() !== "application/json") throw new ApiError(415, "invalid_content_type", "Use application/json.");
  const reader = request.body?.getReader();
  if (!reader) throw new ApiError(400, "invalid_json", "A JSON object is required.");
  const chunks: Uint8Array[] = []; let size = 0;
  try {
    while (true) {
      const { value, done } = await reader.read(); if (done) break;
      size += value.length;
      if (size > 16384) { await reader.cancel(); throw new ApiError(413, "body_too_large", "Request exceeds the size limit."); }
      chunks.push(value);
    }
  } finally { reader.releaseLock(); }
  const bytes = new Uint8Array(size); let offset = 0;
  for (const chunk of chunks) { bytes.set(chunk, offset); offset += chunk.length; }
  let value: unknown;
  try { value = JSON.parse(new TextDecoder("utf-8", { fatal: true }).decode(bytes)); } catch { throw new ApiError(400, "invalid_json", "A JSON object is required."); }
  if (!value || typeof value !== "object" || Array.isArray(value)) throw new ApiError(400, "invalid_json", "A JSON object is required.");
  return value as Record<string, unknown>;
}
export async function processingRequest(request: Request, action: string, jobId?: string) {
  try {
    if (action !== "list") requireSameOrigin(request);
    let data: unknown;
    if (action === "list") {
      await requireAdmin(request);
      data = await listJobs(parseList(new URL(request.url)));
    } else if (action === "create") {
      if (!isProducer(request)) await requireAdmin(request);
      data = await callJob("automation_create_job", parseCreate(await body(request)));
    } else if (action === "hide") {
      await requireAdmin(request);
      data = await hideJob(uuid(jobId));
    } else if (action === "cancel") {
      await requireAdmin(request);
      data = await cancelJob(uuid(jobId));
    } else if (action === "retry") {
      await requireAdmin(request);
      const id = uuid(jobId); parseClaim(await body(request));
      data = await callJob("automation_retry_job", { p_job_id: id });
    } else if (["claim", "heartbeat", "complete", "fail"].includes(action)) {
      const workerId = requireWorker(request);
      if (action === "claim") {
        parseClaim(await body(request));
        data = await callJob("automation_claim_job", { p_worker_id: workerId }, true);
      } else {
        const id = uuid(jobId); const input = await body(request);
        const args = action === "heartbeat" ? parseHeartbeat(input) : action === "fail" ? parseFail(input)
          : parseComplete(input, process.env.AUTOMATION_OUTPUT_ORIGINS ?? "");
        data = await callJob("automation_update_job", { p_job_id: id, p_worker_id: workerId, p_action: action, ...args });
      }
    } else throw new ApiError(404, "not_found", "Unknown processing operation.");
    return Response.json({ data }, { status: action === "create" ? 201 : 200, headers });
  } catch (error) {
    // Avoid the generic API logger: request credentials/database messages must never be logged.
    return Response.json({ error: isApiError(error) ? { code: error.code, message: error.message }
      : { code: "internal_error", message: "Processing request failed." } }, { status: isApiError(error) ? error.status : 500, headers });
  }
}
