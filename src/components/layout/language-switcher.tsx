"use client";

import { useEffect, useRef, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
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
  variant?: "desktop" | "mobile";
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

export function LanguageSwitcher({ variant = "desktop" }: LanguageSwitcherProps) {
  const [selected, setSelected] = useState<LanguageCode>("kk");
  const [open, setOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);
  const selectedOption = languageOptions.find((option) => option.code === selected) ?? languageOptions[0];

  useEffect(() => {
    const storedLanguage = getStoredLanguage();
    setSelected(storedLanguage);
    applyLanguage(storedLanguage);
  }, []);

  useEffect(() => {
    if (!open) {
      return;
    }

    function handlePointerDown(event: PointerEvent) {
      if (!menuRef.current?.contains(event.target as Node)) {
        setOpen(false);
      }
    }

    window.addEventListener("pointerdown", handlePointerDown);

    return () => window.removeEventListener("pointerdown", handlePointerDown);
  }, [open]);

  function selectLanguage(code: LanguageCode) {
    setSelected(code);
    applyLanguage(code);
    setOpen(false);
  }

  if (variant === "mobile") {
    return (
      <div className="rounded-[24px] border border-white/10 bg-white/[0.045] p-3">
        <div className="mb-3 flex items-center gap-2 text-sm font-bold text-white">
          <Languages className="h-4 w-4 text-[var(--accent)]" />
          Тіл
        </div>
        <div className="grid grid-cols-3 gap-2">
          {languageOptions.map((option) => {
            const active = option.code === selected;

            return (
              <button
                key={option.code}
                className={cn(
                  "rounded-2xl border px-3 py-2 text-sm font-bold transition",
                  active
                    ? "border-[rgba(217,183,111,0.42)] bg-[rgba(217,183,111,0.16)] text-[var(--accent)]"
                    : "border-white/10 bg-white/[0.055] text-zinc-300 hover:border-white/20 hover:text-white"
                )}
                type="button"
                onClick={() => selectLanguage(option.code)}
              >
                {option.shortLabel}
              </button>
            );
          })}
        </div>
      </div>
    );
  }

  return (
    <div ref={menuRef} className="relative">
      <button
        className="glass-button flex h-11 items-center gap-2 rounded-full px-3 text-sm font-bold text-white"
        aria-expanded={open}
        aria-label="Тілді ауыстыру"
        type="button"
        onClick={() => setOpen((current) => !current)}
      >
        <Languages className="h-4 w-4 text-[var(--accent)]" />
        <span>Тіл</span>
        <span className="rounded-full bg-white/10 px-2 py-0.5 text-[11px] text-[var(--accent)]">
          {selectedOption.shortLabel}
        </span>
      </button>

      <AnimatePresence>
        {open ? (
          <motion.div
            className="glass-strong absolute right-0 top-[calc(100%+0.6rem)] z-[90] w-44 rounded-[22px] p-2"
            initial={{ opacity: 0, y: -8, scale: 0.98 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -8, scale: 0.98 }}
            transition={{ duration: 0.16 }}
          >
            {languageOptions.map((option) => {
              const active = option.code === selected;

              return (
                <button
                  key={option.code}
                  className={cn(
                    "flex w-full items-center justify-between rounded-2xl px-3 py-2.5 text-left text-sm font-bold transition",
                    active ? "bg-white/[0.12] text-white" : "text-zinc-300 hover:bg-white/[0.08] hover:text-white"
                  )}
                  type="button"
                  onClick={() => selectLanguage(option.code)}
                >
                  <span className="inline-flex items-center gap-2">
                    <span className="text-[var(--accent)]">{option.shortLabel}</span>
                    {option.label}
                  </span>
                  {active ? <Check className="h-4 w-4 text-[var(--accent)]" /> : null}
                </button>
              );
            })}
          </motion.div>
        ) : null}
      </AnimatePresence>
    </div>
  );
}
