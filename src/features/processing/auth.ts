import "server-only";
import { createHash, timingSafeEqual } from "node:crypto";
import { ApiError } from "@/lib/api/errors";

function token(request: Request) { return request.headers.get("authorization")?.match(/^Bearer ([^\s]+)$/i)?.[1]; }
function equal(a: string, b: string) {
  return timingSafeEqual(createHash("sha256").update(a).digest(), createHash("sha256").update(b).digest());
}
function configured(): never { throw new ApiError(503, "automation_not_configured", "Automation credentials are not configured."); }
function validSecret(value: unknown): value is string {
  return typeof value === "string" && value.length >= 32 && value.length <= 512 && !/\s/.test(value)
    && value !== process.env.BACKEND_ADMIN_TOKEN && value !== process.env.SUPABASE_SERVICE_ROLE_KEY;
}
export function requireWorker(request: Request): string {
  const supplied = token(request);
  if (!supplied || supplied.length > 512) throw new ApiError(401, "unauthorized", "Worker authentication is required.");
  let credentials: unknown;
  try { credentials = JSON.parse(process.env.AUTOMATION_WORKER_CREDENTIALS ?? ""); } catch { return configured(); }
  if (!credentials || typeof credentials !== "object" || Array.isArray(credentials)) return configured();
  const entries = Object.entries(credentials);
  if (!entries.length || new Set(entries.map(([, value]) => value)).size !== entries.length
    || entries.some(([id, secret]) => !/^[A-Za-z0-9][A-Za-z0-9_.:-]{0,63}$/.test(id) || !validSecret(secret)
      || secret === process.env.AUTOMATION_PRODUCER_TOKEN)) return configured();
  const matched = entries.find(([, secret]) => equal(supplied, secret as string));
  if (!matched) throw new ApiError(401, "unauthorized", "Worker authentication is required.");
  return matched[0];
}
export function isProducer(request: Request): boolean {
  const supplied = token(request);
  const expected = process.env.AUTOMATION_PRODUCER_TOKEN;
  if (!supplied || supplied.length > 512 || !expected) return false;
  if (!validSecret(expected)) return configured();
  if (process.env.AUTOMATION_WORKER_CREDENTIALS) {
    let workers: unknown;
    try { workers = JSON.parse(process.env.AUTOMATION_WORKER_CREDENTIALS); } catch { return configured(); }
    if (!workers || typeof workers !== "object" || Array.isArray(workers) || Object.values(workers).includes(expected)) return configured();
  }
  return equal(supplied, expected);
}
export function requireSameOrigin(request: Request) {
  const origin = request.headers.get("origin");
  if ((origin && origin !== new URL(request.url).origin) || request.headers.get("sec-fetch-site") === "cross-site") {
    throw new ApiError(403, "forbidden", "Cross-site automation requests are not allowed.");
  }
}
