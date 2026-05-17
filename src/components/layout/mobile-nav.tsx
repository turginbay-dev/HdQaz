"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { Crown, Search, X } from "lucide-react";
import { mainNavigation, searchSuggestions } from "@/lib/navigation";

type MobileNavProps = {
  avatarUrl?: string | null;
  displayName?: string | null;
  isPremium?: boolean;
};

const mobileNavigation = [
  {
    label: "Басты бет",
    href: "/"
  },
  ...mainNavigation.map((item) => (item.href === "/catalog" ? { ...item, label: "Каталог" } : item))
];

function getInitials(value?: string | null) {
  const parts = value?.trim().split(/\s+/).filter(Boolean) ?? [];

  if (parts.length === 0) {
    return "H";
  }

  return parts.slice(0, 2).map((part) => part[0]?.toUpperCase()).join("");
}

export function MobileNav({ displayName, isPremium = false }: MobileNavProps) {
  const [open, setOpen] = useState(false);
  const [searchOpen, setSearchOpen] = useState(false);
  const [searchValue, setSearchValue] = useState("");
  const pathname = usePathname();
  const router = useRouter();
  const searchParams = useSearchParams();
  const searchInputRef = useRef<HTMLInputElement>(null);
  const currentSearchQuery = searchParams.get("q") ?? "";
  const profileInitials = getInitials(displayName);

  useEffect(() => {
    setSearchValue(currentSearchQuery);
  }, [currentSearchQuery]);

  useEffect(() => {
    if (searchOpen) {
      window.requestAnimationFrame(() => searchInputRef.current?.focus());
    }
  }, [searchOpen]);

  function submitSearch(value: string) {
    const query = value.trim();

    if (!query) {
      setSearchOpen(true);
      return;
    }

    const params = new URLSearchParams({ q: query });

    router.push(`/catalog?${params.toString()}`);
    setOpen(false);
    setSearchOpen(false);
  }

  function handleSearchSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    submitSearch(searchValue);
  }

  function clearSearch() {
    setSearchValue("");

    if (pathname === "/catalog" && currentSearchQuery) {
      router.push("/catalog");
    }

    setSearchOpen(true);
  }

  return (
    <>
      <header className="fixed left-0 right-0 top-0 z-50 flex items-center justify-between px-4 py-4 lg:hidden">
        <button
          className="mobile-nav-trigger"
          aria-label="Мәзірді ашу"
          aria-expanded={open}
          type="button"
          onClick={() => {
            setSearchOpen(false);
            setOpen(true);
          }}
        >
          <span className="mobile-nav-menu-lines" aria-hidden="true">
            <span />
            <span />
            <span />
          </span>
        </button>
        <button
          className="mobile-nav-icon-button"
          aria-label="Іздеу"
          aria-expanded={searchOpen}
          type="button"
          onClick={() => {
            setOpen(false);
            setSearchOpen(true);
          }}
        >
          <Search className="h-5 w-5" />
        </button>
      </header>

      <button
        className={`mobile-nav-backdrop fixed inset-0 z-[70] lg:hidden ${searchOpen ? "is-open" : ""}`}
        aria-label="Іздеуді жабу"
        aria-hidden={!searchOpen}
        tabIndex={searchOpen ? 0 : -1}
        type="button"
        onClick={() => setSearchOpen(false)}
      />
      <div
        className={`mobile-nav-panel mobile-nav-search-panel fixed left-3 top-3 z-[80] w-[min(92vw,420px)] rounded-[30px] p-4 lg:hidden ${searchOpen ? "is-open" : ""}`}
        aria-hidden={!searchOpen}
        inert={!searchOpen}
      >
        <div className="flex items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <span className="mobile-nav-icon-soft">
              <Search className="h-5 w-5" />
            </span>
            <p className="text-base font-bold tracking-[-0.01em] text-white">Кино іздеу</p>
          </div>
          <button
            className="mobile-nav-icon-button h-10 w-10"
            aria-label="Жабу"
            type="button"
            onClick={() => setSearchOpen(false)}
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        <form className="mt-4 flex gap-2" onSubmit={handleSearchSubmit}>
          <label className="flex min-h-12 flex-1 items-center gap-3 rounded-2xl border border-white/10 bg-black/20 px-4 text-white">
            <Search className="h-4 w-4 shrink-0 text-[var(--accent)]" />
            <input
              ref={searchInputRef}
              className="min-w-0 flex-1 bg-transparent text-base font-medium tracking-[0.004em] outline-none placeholder:text-zinc-500"
              aria-label="Кино іздеу"
              placeholder="Атауы, жанры, жылы"
              type="search"
              value={searchValue}
              onChange={(event) => setSearchValue(event.target.value)}
            />
          </label>
          {searchValue && (
            <button
              className="mobile-nav-icon-button h-12 w-12 shrink-0 rounded-2xl"
              aria-label="Іздеуді тазалау"
              type="button"
              onMouseDown={(event) => event.preventDefault()}
              onClick={clearSearch}
            >
              <X className="h-5 w-5" />
            </button>
          )}
          <button
            className="mobile-nav-submit-button flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl"
            aria-label="Іздеу"
            type="submit"
          >
            <Search className="h-5 w-5" />
          </button>
        </form>

        <div className="mt-4 flex flex-wrap gap-2">
          {searchSuggestions.map((suggestion) => (
            <button
              key={suggestion}
              className="mobile-nav-chip"
              type="button"
              onClick={() => submitSearch(suggestion)}
            >
              {suggestion}
            </button>
          ))}
        </div>
      </div>

      <button
        className={`mobile-nav-backdrop fixed inset-0 z-[70] lg:hidden ${open ? "is-open" : ""}`}
        aria-label="Мәзірді жабу"
        aria-hidden={!open}
        tabIndex={open ? 0 : -1}
        type="button"
        onClick={() => setOpen(false)}
      />
      <aside
        className={`mobile-nav-panel mobile-nav-drawer fixed left-3 top-3 z-[80] flex h-[calc(100svh-24px)] w-[min(86vw,380px)] flex-col overflow-y-auto overscroll-contain rounded-[30px] p-4 lg:hidden ${open ? "is-open" : ""}`}
        aria-hidden={!open}
        inert={!open}
      >
        <div className="flex items-center justify-between">
          <Link
            href="/"
            aria-label="HdQaz басты бет"
            className="mobile-nav-drawer-brand"
            onClick={() => setOpen(false)}
          >
            <span>HdQaz</span>
          </Link>
          <button
            className="mobile-nav-icon-button h-10 w-10"
            aria-label="Жабу"
            onClick={() => setOpen(false)}
            type="button"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="mt-8 flex flex-col gap-2">
          {mobileNavigation.map((item) => {
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
              <div key={item.href}>
                <Link
                  href={item.href}
                  className={
                    active
                      ? "flex items-center justify-between rounded-2xl border border-white/[0.12] bg-white/[0.12] px-4 py-3 text-base font-bold tracking-[-0.006em] text-white"
                      : "flex items-center justify-between rounded-2xl px-4 py-3 text-base font-semibold tracking-[-0.006em] text-zinc-100 transition hover:bg-white/10"
                  }
                  onClick={() => setOpen(false)}
                >
                  {item.label}
                  {active && <span className="h-1.5 w-1.5 rounded-full bg-[var(--accent)]" />}
                </Link>
              </div>
            );
          })}
          <div>
            <Link
              href="/profile"
              className={
                pathname === "/profile"
                  ? "flex items-center justify-between rounded-2xl border border-white/[0.12] bg-white/[0.12] px-4 py-3 text-base font-bold tracking-[-0.006em] text-white"
                  : "flex items-center justify-between rounded-2xl px-4 py-3 text-base font-semibold tracking-[-0.006em] text-zinc-100 transition hover:bg-white/10"
              }
              onClick={() => setOpen(false)}
            >
              <span className="inline-flex items-center gap-2">
                <span className="mobile-nav-avatar" aria-hidden="true">
                  {profileInitials}
                </span>
                Профиль
              </span>
              {pathname === "/profile" && <span className="h-1.5 w-1.5 rounded-full bg-[var(--accent)]" />}
            </Link>
          </div>
        </div>

        <Link
          href="/premium"
          className="mobile-nav-premium mt-auto"
          onClick={() => setOpen(false)}
        >
          <div className="flex items-center gap-3">
            <span className="flex h-10 w-10 items-center justify-center rounded-full bg-[var(--accent)] text-black">
              <Crown className="h-5 w-5" />
            </span>
            <div>
              <p className="text-sm font-bold tracking-[-0.008em] text-white">HdQaz Premium</p>
              <p className="mt-1 text-sm font-medium leading-5 tracking-[0.004em] text-zinc-400">
                {isPremium ? "Premium белсенді" : "1080p және Premium мүмкіндіктер"}
              </p>
            </div>
          </div>
        </Link>
      </aside>
    </>
  );
}
