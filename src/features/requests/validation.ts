import type { ContentRequestStatus } from "@/types/backend";

type ValidationResult<T> =
  | {
      data: T;
      errors: null;
    }
  | {
      data: null;
      errors: Record<string, string>;
    };

const statuses: ContentRequestStatus[] = ["requested", "in_progress", "ready", "rejected"];

function asString(value: unknown) {
  return typeof value === "string" ? value.trim() : undefined;
}

function asNumber(value: unknown) {
  if (typeof value === "number" && Number.isFinite(value)) {
    return value;
  }

  if (typeof value === "string" && value.trim()) {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : undefined;
  }

  return undefined;
}

export function parseContentRequestInput(payload: Record<string, unknown>): ValidationResult<{
  title: string;
  originalTitle?: string;
  note?: string;
  targetVotes?: number;
}> {
  const errors: Record<string, string> = {};
  const title = asString(payload.title);
  const originalTitle = asString(payload.originalTitle);
  const note = asString(payload.note);
  const targetVotes = asNumber(payload.targetVotes);

  if (!title) {
    errors.title = "Required.";
  } else if (title.length < 2 || title.length > 160) {
    errors.title = "Must be between 2 and 160 characters.";
  }

  if (originalTitle && originalTitle.length > 160) {
    errors.originalTitle = "Must be 160 characters or less.";
  }

  if (note && note.length > 500) {
    errors.note = "Must be 500 characters or less.";
  }

  if (targetVotes !== undefined && (!Number.isInteger(targetVotes) || targetVotes < 1 || targetVotes > 10000)) {
    errors.targetVotes = "Must be an integer between 1 and 10000.";
  }

  if (Object.keys(errors).length > 0 || !title) {
    return {
      data: null,
      errors
    };
  }

  return {
    data: {
      title,
      ...(originalTitle ? { originalTitle } : {}),
      ...(note ? { note } : {}),
      ...(targetVotes ? { targetVotes } : {})
    },
    errors: null
  };
}

export function parseRequestStatus(value: unknown) {
  return typeof value === "string" && statuses.includes(value as ContentRequestStatus)
    ? (value as ContentRequestStatus)
    : undefined;
}
