import { NextResponse } from "next/server";
import { ApiError, isApiError } from "@/lib/api/errors";

export function ok<T>(data: T, init?: ResponseInit) {
  return NextResponse.json({ data }, init);
}

export function created<T>(data: T) {
  return ok(data, { status: 201 });
}

export function noContent() {
  return new NextResponse(null, { status: 204 });
}

export function fail(status: number, code: string, message: string, details?: unknown) {
  return NextResponse.json(
    {
      error: {
        code,
        message,
        ...(details ? { details } : {})
      }
    },
    { status }
  );
}

export function handleApiError(error: unknown) {
  if (isApiError(error)) {
    return fail(error.status, error.code, error.message, error.details);
  }

  console.error(error);

  return fail(500, "internal_error", "Unexpected backend error.");
}

export function notFound(message = "Resource not found.") {
  return fail(404, "not_found", message);
}

export function validationError(details: unknown) {
  return fail(400, "validation_error", "Request validation failed.", details);
}

export function ensureFound<T>(value: T | null | undefined, message?: string): T {
  if (!value) {
    throw new ApiError(404, "not_found", message ?? "Resource not found.");
  }

  return value;
}
