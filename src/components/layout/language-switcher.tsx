"use client";

import { useEffect, useState } from "react";
import { Check, Languages } from "lucide-react";
import { cn } from "@/lib/cn";

const LANGUAGE_STORAGE_KEY = "hdqaz-language";

const languageOptions = [
  {
    code: "kk",
    label: "Қазақша",
    shortLabel: "KK",
    htmlLang: "kk-KZ"
  },
  {
    code: "ru",
    label: "Орысша",
    shortLabel: "RU",
    htmlLang: "ru-RU"
  },
  {
    code: "en",
    label: "Ағылшынша",
    shortLabel: "EN",
    htmlLang: "en-US"
  }
] as const;

type LanguageCode = (typeof languageOptions)[number]["code"];

type LanguageSwitcherProps = {
  variant?: "mobile" | "profile";
};

function isLanguageCode(value: string | null): value is LanguageCode {
  return languageOptions.some((option) => option.code === value);
}

function getStoredLanguage() {
  if (typeof window === "undefined") {
    return "kk" as LanguageCode;
  }

  const stored = window.localStorage.getItem(LANGUAGE_STORAGE_KEY);

  return isLanguageCode(stored) ? stored : "kk";
}

function applyLanguage(code: LanguageCode) {
  const option = languageOptions.find((item) => item.code === code) ?? languageOptions[0];

  document.documentElement.lang = option.htmlLang;
  window.localStorage.setItem(LANGUAGE_STORAGE_KEY, code);
  document.cookie = `${LANGUAGE_STORAGE_KEY}=${code}; path=/; max-age=31536000; samesite=lax`;
}

export function LanguageSwitcher({ variant = "profile" }: LanguageSwitcherProps) {
  const [selected, setSelected] = useState<LanguageCode>("kk");
  const selectedOption = languageOptions.find((option) => option.code === selected) ?? languageOptions[0];

  useEffect(() => {
    const storedLanguage = getStoredLanguage();
    setSelected(storedLanguage);
    applyLanguage(storedLanguage);
  }, []);

  function selectLanguage(code: LanguageCode) {
    setSelected(code);
    applyLanguage(code);
  }

  return (
    <div className={cn("rounded-[24px] border border-white/10 bg-white/[0.045]", variant === "profile" ? "p-4" : "p-3")}>
      <div className="mb-3 flex items-center justify-between gap-3">
        <div className="flex items-center gap-2 text-sm font-bold text-white">
          <Languages className="h-4 w-4 text-[var(--accent)]" />
          Тіл
        </div>
        <span className="rounded-full bg-white/10 px-2.5 py-1 text-[11px] font-bold text-[var(--accent)]">
          {selectedOption.shortLabel}
        </span>
      </div>
      <div className={cn("grid gap-2", variant === "profile" ? "grid-cols-1 sm:grid-cols-3 lg:grid-cols-1" : "grid-cols-3")}>
        {languageOptions.map((option) => {
          const active = option.code === selected;

          return (
            <button
              key={option.code}
              className={cn(
                "flex min-h-11 items-center justify-between rounded-2xl border px-3 py-2 text-sm font-bold transition",
                active
                  ? "border-[rgba(217,183,111,0.42)] bg-[rgba(217,183,111,0.16)] text-[var(--accent)]"
                  : "border-white/10 bg-white/[0.055] text-zinc-300 hover:border-white/20 hover:text-white"
              )}
              type="button"
              onClick={() => selectLanguage(option.code)}
            >
              <span className="inline-flex items-center gap-2">
                <span>{option.shortLabel}</span>
                {variant === "profile" ? <span className="text-zinc-300">{option.label}</span> : null}
              </span>
              {active ? <Check className="h-4 w-4" /> : null}
            </button>
          );
        })}
      </div>
    </div>
  );
}

export function LanguagePreferenceSync() {
  useEffect(() => {
    applyLanguage(getStoredLanguage());
  }, []);

  return null;
}
