"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { AnimatePresence, motion } from "framer-motion";
import { Crown, Search, X } from "lucide-react";
import { LanguageSwitcher } from "@/components/layout/language-switcher";
import { SiteLogo } from "@/components/layout/site-logo";
import { UserAvatar } from "@/components/user/user-avatar";
import { mainNavigation, searchSuggestions } from "@/lib/navigation";
import { cn } from "@/lib/cn";

type DesktopNavProps = {
  avatarUrl?: string | null;
  displayName?: string | null;
  isPremium?: boolean;
};

export function DesktopNav({ avatarUrl, displayName, isPremium = false }: DesktopNavProps) {
  const pathname = usePathname();
  const router = useRouter();
  const searchParams = useSearchParams();
  const searchInputRef = useRef<HTMLInputElement>(null);
  const [desktopActive, setDesktopActive] = useState(false);
  const [scrolled, setScrolled] = useState(false);
  const [searchOpen, setSearchOpen] = useState(false);
  const [focused, setFocused] = useState(false);
  const [hintIndex, setHintIndex] = useState(0);
  const [searchValue, setSearchValue] = useState("");
  const currentSearchQuery = searchParams.get("q") ?? "";

  useEffect(() => {
    const media = window.matchMedia("(min-width: 1024px)");

    function syncDesktopState() {
      setDesktopActive(media.matches);
      setScrolled(media.matches && window.scrollY > 32);
    }

    syncDesktopState();
    media.addEventListener("change", syncDesktopState);

    return () => {
      media.removeEventListener("change", syncDesktopState);
    };
  }, []);

  useEffect(() => {
    if (!desktopActive) {
      return;
    }

    let frame = 0;

    function updateScrolled() {
      frame = 0;
      setScrolled(window.scrollY > 32);
    }

    function handleScroll() {
      if (frame) {
        return;
      }

      frame = window.requestAnimationFrame(updateScrolled);
    }

    handleScroll();
    window.addEventListener("scroll", handleScroll, { passive: true });

    return () => {
      if (frame) {
        window.cancelAnimationFrame(frame);
      }

      window.removeEventListener("scroll", handleScroll);
    };
  }, [desktopActive]);

  useEffect(() => {
    setSearchValue(currentSearchQuery);
  }, [currentSearchQuery]);

  useEffect(() => {
    if (!desktopActive) {
      return;
    }

    const id = window.setInterval(() => {
      setHintIndex((current) => (current + 1) % searchSuggestions.length);
    }, 2200);

    return () => window.clearInterval(id);
  }, [desktopActive]);

  function focusSearchInput() {
    setSearchOpen(true);
    window.requestAnimationFrame(() => searchInputRef.current?.focus());
  }

  function submitSearch(value: string) {
    const query = value.trim();

    if (!query) {
      focusSearchInput();
      return;
    }

    const params = new URLSearchParams({ q: query });

    router.push(`/catalog?${params.toString()}`);
    searchInputRef.current?.blur();
    setFocused(false);
    setSearchOpen(false);
  }

  function handleSearchSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (!searchOpen && !focused) {
      focusSearchInput();
      return;
    }

    submitSearch(searchValue);
  }

  function clearSearch() {
    setSearchValue("");

    if (pathname === "/catalog" && currentSearchQuery) {
      router.push("/catalog");
    }

    focusSearchInput();
  }

  return (
    <header className="fixed left-0 right-0 top-5 z-50 hidden justify-center px-6 lg:flex">
      <motion.nav
        className={cn(
          "flex h-16 items-center gap-2 rounded-full border px-3 transition-colors duration-300",
          scrolled
            ? "border-white/[0.16] bg-black/[0.58] shadow-[0_22px_80px_rgba(0,0,0,0.5)] backdrop-blur-3xl"
            : "border-white/[0.12] bg-white/[0.055] shadow-[0_18px_70px_rgba(0,0,0,0.34)] backdrop-blur-2xl"
        )}
        initial={{ opacity: 0, y: -18, scale: 0.98 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        transition={{ duration: 0.6, ease: [0.22, 1, 0.36, 1] }}
      >
        <SiteLogo className="mr-1" priority />

        <div className="flex items-center">
          {mainNavigation.map((item) => {
            const itemPath = item.href.split("?")[0];
            const itemParams = new URLSearchParams(item.href.split("?")[1]);
            const itemCatalog = itemParams.get("catalog");
            const itemFilter = itemParams.get("filter");
            const currentCatalog = searchParams.get("catalog");
            const currentFilter = searchParams.get("filter");
            const currentGenre = searchParams.get("genre");
            const active =
              pathname === itemPath &&
              (itemCatalog
                ? currentCatalog === itemCatalog
                : itemFilter
                  ? currentFilter === itemFilter
                  : itemPath === "/catalog"
                    ? !currentCatalog && !currentFilter && !currentGenre
                    : true);

            return (
              <Link
                key={item.href}
                href={item.href}
                className="relative rounded-full px-3.5 py-2 text-[0.86rem] font-semibold tracking-[0.012em] text-zinc-300 transition hover:text-white"
              >
                {active && (
                  <motion.span
                    layoutId="desktop-active-nav"
                    className="absolute inset-0 rounded-full border border-white/10 bg-white/[0.12]"
                    transition={{ type: "spring", stiffness: 360, damping: 32 }}
                  />
                )}
                <span className="relative z-10">{item.label}</span>
              </Link>
            );
          })}
        </div>

        <div className="ml-1 flex items-center gap-2 border-l border-white/10 pl-3">
          <motion.form
            className="relative"
            animate={{ width: searchOpen || focused ? 220 : 44 }}
            transition={{ type: "spring", stiffness: 320, damping: 30 }}
            onSubmit={handleSearchSubmit}
            onHoverStart={() => setSearchOpen(true)}
            onHoverEnd={() => {
              if (!focused) {
                setSearchOpen(false);
              }
            }}
          >
            <div
              className={cn(
                "glass-button relative flex h-11 w-full items-center rounded-full text-white",
                searchOpen || focused ? "justify-start gap-2 px-4" : "justify-center"
              )}
            >
              <button
                className="flex h-5 w-5 shrink-0 items-center justify-center text-white"
                aria-label="Кино іздеу"
                type="submit"
              >
                <Search className="h-4 w-4" />
              </button>
              {(searchOpen || focused) && (
                <>
                  <input
                    ref={searchInputRef}
                    className="min-w-0 flex-1 bg-transparent text-sm tracking-[0.01em] text-white outline-none placeholder:text-transparent"
                    aria-label="Кино іздеу"
                    value={searchValue}
                    onChange={(event) => setSearchValue(event.target.value)}
                    onFocus={() => {
                      setFocused(true);
                      setSearchOpen(true);
                    }}
                    onBlur={() => {
                      setFocused(false);
                      setSearchOpen(false);
                    }}
                  />
                  {searchValue && (
                    <button
                      className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-zinc-400 transition hover:bg-white/10 hover:text-white"
                      aria-label="Іздеуді тазалау"
                      type="button"
                      onMouseDown={(event) => event.preventDefault()}
                      onClick={clearSearch}
                    >
                      <X className="h-3.5 w-3.5" />
                    </button>
                  )}
                  {!focused && !searchValue && (
                    <AnimatePresence mode="wait">
                      <motion.span
                        key={searchSuggestions[hintIndex]}
                        className="pointer-events-none absolute left-10 right-4 truncate text-sm tracking-[0.01em] text-zinc-400"
                        initial={{ opacity: 0, y: 8, filter: "blur(6px)" }}
                        animate={{ opacity: 1, y: 0, filter: "blur(0px)" }}
                        exit={{ opacity: 0, y: -8, filter: "blur(6px)" }}
                        transition={{ duration: 0.24 }}
                      >
                        {searchSuggestions[hintIndex]}
                      </motion.span>
                    </AnimatePresence>
                  )}
                </>
              )}
            </div>
          </motion.form>

          <LanguageSwitcher />

          <Link
            href="/premium"
            className="glass-button flex h-11 items-center gap-2 rounded-full border-[rgba(217,183,111,0.32)] px-3.5 text-sm font-semibold tracking-[0.012em] text-white shadow-[0_0_28px_rgba(217,183,111,0.1)] hover:shadow-[0_0_38px_rgba(217,183,111,0.18)]"
          >
            <Crown className="h-4 w-4 text-[var(--accent)]" />
            {isPremium ? "Premium" : "Premium алу"}
          </Link>

          <Link
            href="/profile"
            className="flex h-11 w-11 items-center justify-center rounded-full border border-white/15 bg-white/[0.08] p-0.5 shadow-[0_14px_45px_rgba(255,255,255,0.12)] transition hover:scale-105"
            aria-label="Профиль"
          >
            <UserAvatar
              avatarUrl={avatarUrl}
              displayName={displayName}
              className="h-full w-full"
              sizes="44px"
            />
          </Link>
        </div>
      </motion.nav>
    </header>
  );
}
