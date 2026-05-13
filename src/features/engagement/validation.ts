type ValidationResult<T> =
  | {
      data: T;
      errors: null;
    }
  | {
      data: null;
      errors: Record<string, string>;
    };

const commentLimit = 500;
const blockedWords = ["боқ", "қотақ", "нах", "сука", "блять"];

function asString(value: unknown) {
  return typeof value === "string" ? value.trim() : undefined;
}

function asBoolean(value: unknown) {
  return typeof value === "boolean" ? value : undefined;
}

export function parseMovieSlugPayload(payload: Record<string, unknown>): ValidationResult<{ movieSlug: string }> {
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
    data: { movieSlug },
    errors: null
  };
}

export function parseCommentInput(payload: Record<string, unknown>): ValidationResult<{
  body: string;
  isSpoiler: boolean;
  movieSlug: string;
}> {
  const errors: Record<string, string> = {};
  const movieSlug = asString(payload.movieSlug);
  const body = asString(payload.body);
  const isSpoiler = asBoolean(payload.isSpoiler) ?? false;

  if (!movieSlug) {
    errors.movieSlug = "Required.";
  }

  if (!body) {
    errors.body = "Required.";
  } else if (body.length > commentLimit) {
    errors.body = `Must be ${commentLimit} characters or less.`;
  } else if ((body.match(/https?:\/\//gi)?.length ?? 0) > 1) {
    errors.body = "Too many links.";
  } else if (/(.)\1{14,}/u.test(body)) {
    errors.body = "Looks like spam.";
  } else if (blockedWords.some((word) => body.toLowerCase().includes(word))) {
    errors.body = "Құрмет сақтап жазайық.";
  }

  if (Object.keys(errors).length > 0 || !movieSlug || !body) {
    return {
      data: null,
      errors
    };
  }

  return {
    data: {
      body,
      isSpoiler,
      movieSlug
    },
    errors: null
  };
}

export function parseModerationInput(payload: Record<string, unknown>): ValidationResult<{
  action: "hide" | "restore" | "mark_spoiler" | "remove_spoiler";
  hiddenReason?: string;
}> {
  const action = asString(payload.action);
  const hiddenReason = asString(payload.hiddenReason);

  if (!action || !["hide", "restore", "mark_spoiler", "remove_spoiler"].includes(action)) {
    return {
      data: null,
      errors: {
        action: "Unsupported action."
      }
    };
  }

  return {
    data: {
      action: action as "hide" | "restore" | "mark_spoiler" | "remove_spoiler",
      ...(hiddenReason ? { hiddenReason } : {})
    },
    errors: null
  };
}

export function parseViewInput(payload: Record<string, unknown>): ValidationResult<{
  movieSlug: string;
  sessionId?: string;
}> {
  const errors: Record<string, string> = {};
  const movieSlug = asString(payload.movieSlug);
  const sessionId = asString(payload.sessionId);

  if (!movieSlug) {
    errors.movieSlug = "Required.";
  }

  if (sessionId && !/^[a-zA-Z0-9:_-]{12,100}$/.test(sessionId)) {
    errors.sessionId = "Invalid session id.";
  }

  if (Object.keys(errors).length > 0 || !movieSlug) {
    return {
      data: null,
      errors
    };
  }

  return {
    data: {
      movieSlug,
      ...(sessionId ? { sessionId } : {})
    },
    errors: null
  };
}
