import { type NextRequest, NextResponse } from "next/server";
import { ApiError } from "@/lib/api/errors";
import { readJsonObject } from "@/lib/api/request";
import { fail, handleApiError, ok, validationError } from "@/lib/api/responses";
import { getSiteUrl } from "@/lib/site-url";
import { getSupabaseConfig } from "@/lib/supabase/config";
import { createClient } from "@/lib/supabase/server";

export const runtime = "nodejs";

const RATE_LIMIT_WINDOW_MS = 60_000;
const RATE_LIMIT_MAX_REQUESTS = 3;
const RATE_LIMIT_CLEANUP_THRESHOLD = 10_000;
const PASSWORD_MIN_LENGTH = 8;
const PASSWORD_MAX_LENGTH = 128;
const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

type RateLimitEntry = {
  count: number;
  resetAt: number;
};

type SignupInput = {
  email: string;
  password: string;
};

const signupRateLimitStore = new Map<string, RateLimitEntry>();
let lastRateLimitCleanupAt = 0;

function getFirstHeaderValue(value: string | null) {
  return value?.split(",")[0]?.trim() || undefined;
}

function getClientIp(request: NextRequest) {
  const cloudflareIp = getFirstHeaderValue(request.headers.get("cf-connecting-ip"));
  const forwardedForIp = getFirstHeaderValue(request.headers.get("x-forwarded-for"));

  // IP addresses are read only from trusted proxy headers, never from the request body.
  // Cloudflare sets cf-connecting-ip; Vercel and most proxies append x-forwarded-for.
  return cloudflareIp ?? forwardedForIp ?? "unknown";
}

function cleanupExpiredRateLimits(now: number) {
  if (signupRateLimitStore.size < RATE_LIMIT_CLEANUP_THRESHOLD && now - lastRateLimitCleanupAt < RATE_LIMIT_WINDOW_MS) {
    return;
  }

  lastRateLimitCleanupAt = now;

  for (const [key, value] of signupRateLimitStore) {
    if (value.resetAt <= now) {
      signupRateLimitStore.delete(key);
    }
  }
}

function consumeSignupRateLimit(ip: string) {
  const now = Date.now();
  cleanupExpiredRateLimits(now);

  const current = signupRateLimitStore.get(ip);

  if (!current || current.resetAt <= now) {
    const resetAt = now + RATE_LIMIT_WINDOW_MS;
    signupRateLimitStore.set(ip, {
      count: 1,
      resetAt
    });

    return {
      limited: false,
      remaining: RATE_LIMIT_MAX_REQUESTS - 1,
      resetAt
    };
  }

  if (current.count >= RATE_LIMIT_MAX_REQUESTS) {
    return {
      limited: true,
      remaining: 0,
      resetAt: current.resetAt
    };
  }

  current.count += 1;

  return {
    limited: false,
    remaining: RATE_LIMIT_MAX_REQUESTS - current.count,
    resetAt: current.resetAt
  };
}

function getRateLimitHeaders(rateLimit: ReturnType<typeof consumeSignupRateLimit>) {
  return {
    "X-RateLimit-Limit": String(RATE_LIMIT_MAX_REQUESTS),
    "X-RateLimit-Remaining": String(rateLimit.remaining),
    "X-RateLimit-Reset": String(Math.ceil(rateLimit.resetAt / 1000))
  };
}

function parseSignupInput(payload: Record<string, unknown>) {
  const errors: Record<string, string> = {};
  const email = typeof payload.email === "string" ? payload.email.trim().toLowerCase() : "";
  const password = typeof payload.password === "string" ? payload.password : "";

  if (!email) {
    errors.email = "Required.";
  } else if (email.length > 254 || !EMAIL_PATTERN.test(email)) {
    errors.email = "Must be a valid email address.";
  }

  if (!password) {
    errors.password = "Required.";
  } else if (password.length < PASSWORD_MIN_LENGTH) {
    errors.password = `Must be at least ${PASSWORD_MIN_LENGTH} characters.`;
  } else if (password.length > PASSWORD_MAX_LENGTH) {
    errors.password = `Must be ${PASSWORD_MAX_LENGTH} characters or less.`;
  }

  if (Object.keys(errors).length > 0) {
    return {
      data: null,
      errors
    };
  }

  return {
    data: {
      email,
      password
    } satisfies SignupInput,
    errors: null
  };
}

function getEmailRedirectTo() {
  return new URL("/auth/callback", getSiteUrl()).toString();
}

export async function POST(request: NextRequest) {
  const clientIp = getClientIp(request);
  const rateLimit = consumeSignupRateLimit(clientIp);
  const rateLimitHeaders = getRateLimitHeaders(rateLimit);

  if (rateLimit.limited) {
    const retryAfterSeconds = Math.max(1, Math.ceil((rateLimit.resetAt - Date.now()) / 1000));

    // The rate limit happens before JSON parsing or Supabase calls to reduce SMTP abuse
    // and keep repeated signup attempts from becoming expensive backend work.
    return NextResponse.json(
      {
        error: {
          code: "rate_limited",
          message: "Too many signup attempts. Try again in a minute."
        }
      },
      {
        status: 429,
        headers: {
          ...rateLimitHeaders,
          "Retry-After": String(retryAfterSeconds)
        }
      }
    );
  }

  try {
    const contentType = request.headers.get("content-type") ?? "";

    if (!contentType.toLowerCase().includes("application/json")) {
      throw new ApiError(415, "unsupported_media_type", "Content-Type must be application/json.");
    }

    const config = getSupabaseConfig();

    if (!config.configured) {
      return fail(503, "supabase_not_configured", "Authentication is not configured.");
    }

    const payload = await readJsonObject(request);
    const parsed = parseSignupInput(payload);

    if (parsed.errors) {
      return validationError(parsed.errors);
    }

    const supabase = await createClient();
    const { data, error } = await supabase.auth.signUp({
      email: parsed.data.email,
      password: parsed.data.password,
      options: {
        emailRedirectTo: getEmailRedirectTo()
      }
    });

    if (error) {
      return fail(
        400,
        "signup_failed",
        "Signup could not be completed. Check your email and password, then try again."
      );
    }

    if (!data.user) {
      return fail(502, "signup_failed", "Signup could not be completed.");
    }

    // Never return Supabase access or refresh tokens from this endpoint.
    // If email confirmation is enabled, Supabase sends the confirmation email
    // with /auth/callback as the redirect target.
    return ok(
      {
        emailConfirmationRequired: !data.session,
        message: data.session ? "Account created." : "Check your email to confirm your account."
      },
      {
        status: 201,
        headers: rateLimitHeaders
      }
    );
  } catch (error) {
    return handleApiError(error);
  }
}
