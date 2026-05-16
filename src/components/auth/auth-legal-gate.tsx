"use client";

import { useCallback, useState } from "react";
import { EmailPasswordAuthForm } from "@/components/auth/email-password-auth-form";
import { GoogleSignInButton } from "@/components/auth/google-sign-in-button";

type AuthLegalGateProps = {
  disabled?: boolean;
};

const LEGAL_CONSENT_MESSAGE =
  "Жалғастыру үшін Пайдалану шарттары мен Құпиялылық саясатына келісуіңіз керек.";

export function AuthLegalGate({ disabled = false }: AuthLegalGateProps) {
  const [legalAccepted, setLegalAccepted] = useState(false);
  const [legalError, setLegalError] = useState<string | null>(null);

  const requireLegalConsent = useCallback(() => {
    if (legalAccepted) {
      setLegalError(null);
      return true;
    }

    setLegalError(LEGAL_CONSENT_MESSAGE);
    return false;
  }, [legalAccepted]);

  function handleLegalAcceptedChange(accepted: boolean) {
    setLegalAccepted(accepted);

    if (accepted) {
      setLegalError(null);
    }
  }

  return (
    <>
      <div className="mt-6">
        <EmailPasswordAuthForm
          disabled={disabled}
          legalAccepted={legalAccepted}
          legalError={legalError}
          onLegalAcceptedChange={handleLegalAcceptedChange}
          onRequireLegalConsent={requireLegalConsent}
        />
      </div>

      <div className="my-6 flex items-center gap-3 text-xs font-semibold uppercase tracking-[0.18em] text-zinc-500">
        <span className="h-px flex-1 bg-white/10" />
        немесе
        <span className="h-px flex-1 bg-white/10" />
      </div>

      <div>
        <GoogleSignInButton
          disabled={disabled}
          legalAccepted={legalAccepted}
          onRequireLegalConsent={requireLegalConsent}
        />
      </div>
    </>
  );
}
