import { ApiError } from "@/lib/api/errors";

export async function readJsonObject(request: Request) {
  let payload: unknown;

  try {
    payload = await request.json();
  } catch {
    throw new ApiError(400, "invalid_json", "Request body must be valid JSON.");
  }

  if (!payload || typeof payload !== "object" || Array.isArray(payload)) {
    throw new ApiError(400, "invalid_body", "Request body must be a JSON object.");
  }

  return payload as Record<string, unknown>;
}

export function getSearchString(params: URLSearchParams, key: string) {
  const value = params.get(key)?.trim();

  return value || undefined;
}

export function getSearchBoolean(params: URLSearchParams, key: string) {
  const value = params.get(key)?.trim().toLowerCase();

  if (!value) {
    return undefined;
  }

  return ["1", "true", "yes"].includes(value);
}

export function getPagination(params: URLSearchParams) {
  const limit = Number(params.get("limit") ?? 50);
  const offset = Number(params.get("offset") ?? 0);

  return {
    limit: Number.isFinite(limit) ? Math.min(Math.max(Math.trunc(limit), 1), 100) : 50,
    offset: Number.isFinite(offset) ? Math.max(Math.trunc(offset), 0) : 0
  };
}
