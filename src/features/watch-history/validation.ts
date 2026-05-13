type ValidationResult<T> =
  | {
      data: T;
      errors: null;
    }
  | {
      data: null;
      errors: Record<string, string>;
    };

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

export function parseWatchProgressPayload(payload: Record<string, unknown>): ValidationResult<{
  contentId: string;
  durationSeconds: number;
  progressSeconds: number;
}> {
  const errors: Record<string, string> = {};
  const contentId = asString(payload.contentId);
  const progressSeconds = asNumber(payload.progressSeconds ?? payload.positionSeconds);
  const durationSeconds = asNumber(payload.durationSeconds);

  if (!contentId) {
    errors.contentId = "Required.";
  }

  if (progressSeconds === undefined) {
    errors.progressSeconds = "Must be a finite number.";
  }

  if (durationSeconds === undefined) {
    errors.durationSeconds = "Must be a finite number.";
  }

  if (Object.keys(errors).length > 0 || !contentId || progressSeconds === undefined || durationSeconds === undefined) {
    return {
      data: null,
      errors
    };
  }

  return {
    data: {
      contentId,
      durationSeconds,
      progressSeconds
    },
    errors: null
  };
}
