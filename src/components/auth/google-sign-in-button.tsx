"use client";

import type { FormEvent } from "react";
import { signInWithGoogle } from "@/app/auth/actions";

type GoogleSignInButtonProps = {
  disabled?: boolean;
  legalAccepted: boolean;
  onRequireLegalConsent: () => boolean;
};

export function GoogleSignInButton({
  disabled = false,
  legalAccepted,
  onRequireLegalConsent
}: GoogleSignInButtonProps) {
  const googleDisabled = disabled || !legalAccepted;
  const showConsentOverlay = !disabled && !legalAccepted;

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    if (!legalAccepted) {
      event.preventDefault();
      onRequireLegalConsent();
    }
  }

  return (
    <form action={signInWithGoogle} className="relative" onSubmit={handleSubmit}>
      <button
        disabled={googleDisabled}
        className="cinema-sweep inline-flex min-h-14 w-full items-center justify-center gap-3 rounded-full bg-white px-6 text-sm font-semibold text-black shadow-[0_18px_70px_rgba(255,255,255,0.18)] transition hover:bg-[#f3ead5] disabled:cursor-not-allowed disabled:opacity-55"
        type="submit"
      >
        <span className="flex h-6 w-6 items-center justify-center rounded-full border border-black/10 bg-white text-sm font-black text-black">
          G
        </span>
        Google арқылы кіру
      </button>
      {showConsentOverlay ? (
        <button
          aria-label="Google арқылы жалғастыру үшін құқықтық шарттарға келісу керек"
          className="absolute inset-0 rounded-full cursor-not-allowed bg-transparent"
          onClick={onRequireLegalConsent}
          type="button"
        />
      ) : null}
    </form>
  );
}
