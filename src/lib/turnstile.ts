const TURNSTILE_VERIFY_URL = "https://challenges.cloudflare.com/turnstile/v0/siteverify";
const MAX_TURNSTILE_TOKEN_LENGTH = 2048;

type HeaderReader = {
  get(name: string): string | null;
};

type TurnstileVerifyResponse = {
  success?: boolean;
  "error-codes"?: string[];
};

export type TurnstileVerificationResult = {
  errorCode?: "missing_token" | "invalid_token" | "not_configured" | "verify_failed";
  errors?: string[];
  skipped?: boolean;
  success: boolean;
};

function getTurnstileSecretKey() {
  return (
    process.env.TURNSTILE_SECRET_KEY?.trim() ||
    process.env.CLOUDFLARE_TURNSTILE_SECRET_KEY?.trim() ||
    ""
  );
}

function isTurnstileConfigured() {
  return Boolean(process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY?.trim() || getTurnstileSecretKey());
}

function getFirstHeaderValue(value: string | null) {
  return value?.split(",")[0]?.trim() || undefined;
}

export function getClientIpFromHeaders(headers: HeaderReader) {
  const cloudflareIp = getFirstHeaderValue(headers.get("cf-connecting-ip"));
  const forwardedForIp = getFirstHeaderValue(headers.get("x-forwarded-for"));

  return cloudflareIp ?? forwardedForIp;
}

export async function verifyTurnstileToken(
  token: string,
  remoteIp?: string
): Promise<TurnstileVerificationResult> {
  if (!isTurnstileConfigured()) {
    return {
      skipped: true,
      success: true
    };
  }

  const secret = getTurnstileSecretKey();

  if (!secret) {
    return {
      errorCode: "not_configured",
      success: false
    };
  }

  const normalizedToken = token.trim();

  if (!normalizedToken || normalizedToken.length > MAX_TURNSTILE_TOKEN_LENGTH) {
    return {
      errorCode: "missing_token",
      success: false
    };
  }

  const body = new FormData();
  body.set("secret", secret);
  body.set("response", normalizedToken);

  if (remoteIp) {
    body.set("remoteip", remoteIp);
  }

  try {
    const response = await fetch(TURNSTILE_VERIFY_URL, {
      body,
      method: "POST"
    });

    if (!response.ok) {
      return {
        errorCode: "verify_failed",
        success: false
      };
    }

    const result = (await response.json()) as TurnstileVerifyResponse;

    if (!result.success) {
      return {
        errorCode: "invalid_token",
        errors: result["error-codes"],
        success: false
      };
    }

    return {
      success: true
    };
  } catch {
    return {
      errorCode: "verify_failed",
      success: false
    };
  }
}
