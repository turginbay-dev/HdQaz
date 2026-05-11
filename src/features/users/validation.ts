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

function isUrl(value: string) {
  try {
    const url = new URL(value);
    return url.protocol === "http:" || url.protocol === "https:";
  } catch {
    return false;
  }
}

export function parseProfilePatch(payload: Record<string, unknown>): ValidationResult<{
  displayName?: string;
  avatarUrl?: string | null;
}> {
  const errors: Record<string, string> = {};
  const displayName = asString(payload.displayName);
  const avatarUrl = payload.avatarUrl === null ? null : asString(payload.avatarUrl);

  if (displayName && (displayName.length < 2 || displayName.length > 80)) {
    errors.displayName = "Must be between 2 and 80 characters.";
  }

  if (typeof avatarUrl === "string" && !isUrl(avatarUrl)) {
    errors.avatarUrl = "Must be a valid URL.";
  }

  if (Object.keys(errors).length > 0) {
    return {
      data: null,
      errors
    };
  }

  return {
    data: {
      ...(displayName ? { displayName } : {}),
      ...(avatarUrl !== undefined ? { avatarUrl } : {})
    },
    errors: null
  };
}

export function parseWatchProgressInput(payload: Record<string, unknown>): ValidationResult<{
  movieSlug: string;
  positionSeconds: number;
  durationSeconds: number;
  completed?: boolean;
}> {
  const errors: Record<string, string> = {};
  const movieSlug = asString(payload.movieSlug);
  const positionSeconds = asNumber(payload.positionSeconds);
  const durationSeconds = asNumber(payload.durationSeconds);
  const completed = typeof payload.completed === "boolean" ? payload.completed : undefined;

  if (!movieSlug) {
    errors.movieSlug = "Required.";
  }

  if (positionSeconds === undefined || positionSeconds < 0) {
    errors.positionSeconds = "Must be a non-negative number.";
  }

  if (durationSeconds === undefined || durationSeconds <= 0) {
    errors.durationSeconds = "Must be a positive number.";
  }

  if (
    positionSeconds !== undefined &&
    durationSeconds !== undefined &&
    durationSeconds > 0 &&
    positionSeconds > durationSeconds + 30
  ) {
    errors.positionSeconds = "Cannot be greater than durationSeconds.";
  }

  if (Object.keys(errors).length > 0 || !movieSlug || positionSeconds === undefined || durationSeconds === undefined) {
    return {
      data: null,
      errors
    };
  }

  return {
    data: {
      movieSlug,
      positionSeconds,
      durationSeconds,
      ...(completed !== undefined ? { completed } : {})
    },
    errors: null
  };
}

export function parseMovieSlugInput(payload: Record<string, unknown>): ValidationResult<{ movieSlug: string }> {
  const movieSlug = asString(payload.movieSlug);

  if (!movieSlug) {
    return {
      data: null,
      errors: {
        movieSlug: "Required."
      }
    };
  }

  return {
    data: {
      movieSlug
    },
    errors: null
  };
}
