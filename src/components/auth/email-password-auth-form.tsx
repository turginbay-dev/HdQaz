"use client";

import { useCallback, useState, type MouseEvent } from "react";
import { useRouter } from "next/navigation";
import { LockKeyhole, LogIn, Mail, UserPlus } from "lucide-react";
import { signInWithPassword } from "@/app/auth/actions";
import { TurnstileWidget } from "@/components/auth/turnstile-widget";

type EmailPasswordAuthFormProps = {
  disabled?: boolean;
};

type SignupResponse = {
  data?: {
    emailConfirmationRequired: boolean;
    message: string;
  };
  error?: {
    message: string;
  };
};

const SIGNUP_PASSWORD_MIN_LENGTH = 8;
const TURNSTILE_SITE_KEY = process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY ?? "";

export function EmailPasswordAuthForm({ disabled = false }: EmailPasswordAuthFormProps) {
  const router = useRouter();
  const [signupError, setSignupError] = useState<string | null>(null);
  const [signupStatus, setSignupStatus] = useState<string | null>(null);
  const [isSigningUp, setIsSigningUp] = useState(false);
  const [turnstileToken, setTurnstileToken] = useState("");
  const [turnstileResetKey, setTurnstileResetKey] = useState(0);
  const turnstileRequired = Boolean(TURNSTILE_SITE_KEY);

  const resetTurnstile = useCallback(() => {
    if (!turnstileRequired) {
      return;
    }

    setTurnstileToken("");
    setTurnstileResetKey((current) => current + 1);
  }, [turnstileRequired]);

  async function handleSignup(event: MouseEvent<HTMLButtonElement>) {
    event.preventDefault();

    const form = event.currentTarget.form;

    if (!form || disabled || isSigningUp || !form.reportValidity()) {
      return;
    }

    const formData = new FormData(form);
    const email = String(formData.get("email") ?? "");
    const password = String(formData.get("password") ?? "");

    setSignupError(null);
    setSignupStatus(null);

    if (password.length < SIGNUP_PASSWORD_MIN_LENGTH) {
      setSignupError(`Signup passwords must be at least ${SIGNUP_PASSWORD_MIN_LENGTH} characters.`);
      return;
    }

    if (turnstileRequired && !turnstileToken) {
      setSignupError("Қауіпсіздік тексерісін аяқтаңыз.");
      return;
    }

    setIsSigningUp(true);

    try {
      const response = await fetch("/api/auth/signup", {
        method: "POST",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          email,
          password,
          turnstileToken
        })
      });
      const result = (await response.json()) as SignupResponse;

      if (!response.ok) {
        setSignupError(result.error?.message ?? "Signup failed.");
        return;
      }

      if (result.data?.emailConfirmationRequired) {
        setSignupStatus(result.data.message);
        return;
      }

      router.push("/profile");
      router.refresh();
    } catch {
      setSignupError("Signup failed. Try again later.");
    } finally {
      setIsSigningUp(false);
      resetTurnstile();
    }
  }

  return (
    <form action={signInWithPassword} className="space-y-4">
      <input name="cf-turnstile-response" type="hidden" value={turnstileToken} readOnly />

      <label className="block">
        <span className="mb-2 flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.16em] text-zinc-400">
          <Mail className="h-3.5 w-3.5" />
          Email
        </span>
        <input
          className="h-12 w-full rounded-2xl border border-white/10 bg-white/[0.07] px-4 text-sm text-white outline-none transition placeholder:text-zinc-500 focus:border-[rgba(217,183,111,0.48)] focus:bg-white/[0.1]"
          disabled={disabled}
          name="email"
          type="email"
          autoComplete="email"
          inputMode="email"
          placeholder="you@example.com"
          required
        />
      </label>

      <label className="block">
        <span className="mb-2 flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.16em] text-zinc-400">
          <LockKeyhole className="h-3.5 w-3.5" />
          Пароль
        </span>
        <input
          className="h-12 w-full rounded-2xl border border-white/10 bg-white/[0.07] px-4 text-sm text-white outline-none transition placeholder:text-zinc-500 focus:border-[rgba(217,183,111,0.48)] focus:bg-white/[0.1]"
          disabled={disabled}
          name="password"
          type="password"
          autoComplete="current-password"
          placeholder="Кемінде 8 таңба"
          minLength={6}
          required
        />
      </label>

      {signupError && (
        <div className="rounded-2xl border border-red-400/20 bg-red-500/10 p-3 text-sm leading-6 text-red-100">
          {signupError}
        </div>
      )}

      {signupStatus && (
        <div className="rounded-2xl border border-emerald-400/20 bg-emerald-500/10 p-3 text-sm leading-6 text-emerald-100">
          {signupStatus}
        </div>
      )}

      <TurnstileWidget
        disabled={disabled || isSigningUp}
        onTokenChange={setTurnstileToken}
        resetKey={turnstileResetKey}
        siteKey={TURNSTILE_SITE_KEY}
      />

      <div className="grid gap-3 sm:grid-cols-2">
        <button
          disabled={disabled || isSigningUp || (turnstileRequired && !turnstileToken)}
          className="cinema-sweep inline-flex min-h-12 items-center justify-center gap-2 rounded-full bg-[var(--accent)] px-5 text-sm font-semibold text-black shadow-[0_18px_70px_rgba(217,183,111,0.18)] transition hover:bg-[#f3d78e] disabled:cursor-not-allowed disabled:opacity-55"
          type="submit"
        >
          <LogIn className="h-4 w-4" />
          Кіру
        </button>
        <button
          disabled={disabled || isSigningUp || (turnstileRequired && !turnstileToken)}
          onClick={handleSignup}
          className="glass-button inline-flex min-h-12 items-center justify-center gap-2 rounded-full px-5 text-sm font-semibold text-white disabled:cursor-not-allowed disabled:opacity-55"
          type="button"
        >
          <UserPlus className="h-4 w-4" />
          {isSigningUp ? "Жіберілуде" : "Тіркелу"}
        </button>
      </div>
    </form>
  );
}
