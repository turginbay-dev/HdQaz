"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { Crown, Search, X } from "lucide-react";
import { SiteLogo } from "@/components/layout/site-logo";
import { UserAvatar } from "@/components/user/user-avatar";
import { MovieImage } from "@/components/movie/movie-image";
import { contentStatusLabels, contentTypeLabels, formatDurationMinutes, formatEpisodeCount, isEpisodicContent } from "@/features/content/format";
import { mainNavigation } from "@/lib/navigation";
import type { Movie } from "@/types/movie";

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

type SearchResponse = {
  data?: {
    items?: Movie[];
  };
};

function getMovieMeta(movie: Movie) {
  const typeLabel = movie.type ? contentTypeLabels[movie.type] : "Фильм";
  const statusLabel = movie.status ? contentStatusLabels[movie.status] : movie.isNewRelease ? "Жаңа" : "Аяқталған";
  const lengthLabel = isEpisodicContent(movie)
    ? formatEpisodeCount(movie.episodeCount)
    : formatDurationMinutes(movie.durationMinutes) || movie.runtime;

  return [typeLabel, movie.year ? String(movie.year) : "", statusLabel, lengthLabel, movie.dubber?.name ?? ""]
    .filter(Boolean)
    .join(" · ");
}

function normalizeSearchText(value: string) {
  return value.trim().toLocaleLowerCase("kk-KZ");
}

function sortSearchResults(results: Movie[], query: string) {
  const normalizedQuery = normalizeSearchText(query);

  function score(movie: Movie) {
    const title = normalizeSearchText(movie.title);
    const originalTitle = normalizeSearchText(movie.originalTitle);

    if (title === normalizedQuery) return 0;
    if (title.startsWith(normalizedQuery)) return 1;
    if (originalTitle.startsWith(normalizedQuery)) return 2;
    if (title.includes(normalizedQuery)) return 3;
    if (originalTitle.includes(normalizedQuery)) return 4;

    return 5;
  }

  return [...results].sort((left, right) => score(left) - score(right) || left.title.localeCompare(right.title, "kk-KZ"));
}

export function MobileNav({ avatarUrl, displayName, isPremium = false }: MobileNavProps) {
  const [open, setOpen] = useState(false);
  const [searchOpen, setSearchOpen] = useState(false);
  const [searchLoading, setSearchLoading] = useState(false);
  const [searchResults, setSearchResults] = useState<Movie[]>([]);
  const [searchValue, setSearchValue] = useState("");
  const pathname = usePathname();
  const router = useRouter();
  const searchParams = useSearchParams();
  const searchInputRef = useRef<HTMLInputElement>(null);
  const currentSearchQuery = searchParams.get("q") ?? "";
  const trimmedSearch = searchValue.trim();

  useEffect(() => {
    setSearchValue(currentSearchQuery);
  }, [currentSearchQuery]);

  useEffect(() => {
    if (searchOpen) {
      window.requestAnimationFrame(() => searchInputRef.current?.focus());
    }
  }, [searchOpen]);

  useEffect(() => {
    if (!searchOpen) {
      setSearchResults([]);
      setSearchLoading(false);
      return;
    }

    const query = searchValue.trim();

    if (!query) {
      setSearchResults([]);
      setSearchLoading(false);
      return;
    }

    const controller = new AbortController();
    const timeout = window.setTimeout(async () => {
      setSearchLoading(true);

      try {
        const response = await fetch(`/api/movies?q=${encodeURIComponent(query)}&limit=50`, {
          signal: controller.signal
        });

        if (!response.ok) {
          setSearchResults([]);
          return;
        }

        const payload = (await response.json()) as SearchResponse;
        setSearchResults(sortSearchResults(payload.data?.items ?? [], query));
      } catch (error) {
        if (!controller.signal.aborted) {
          setSearchResults([]);
        }
      } finally {
        if (!controller.signal.aborted) {
          setSearchLoading(false);
        }
      }
    }, 180);

    return () => {
      controller.abort();
      window.clearTimeout(timeout);
    };
  }, [searchOpen, searchValue]);

  function openMovie(slug: string) {
    router.push(`/${slug}`);
    setOpen(false);
    setSearchOpen(false);
  }

  function handleSearchSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
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
        className={`mobile-nav-panel mobile-nav-search-panel fixed left-3 right-3 top-3 z-[80] rounded-[26px] p-3 lg:hidden ${searchOpen ? "is-open" : ""}`}
        aria-hidden={!searchOpen}
        inert={!searchOpen}
      >
        <form onSubmit={handleSearchSubmit}>
          <label className="flex min-h-12 flex-1 items-center gap-3 rounded-[18px] border border-white/10 bg-black/24 px-4 text-white">
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
        </form>

        {trimmedSearch ? (
          <div className="mobile-search-results mt-3">
            {searchLoading ? (
              <div className="mobile-search-state">Ізделіп жатыр...</div>
            ) : searchResults.length > 0 ? (
              searchResults.map((movie) => (
                <button
                  key={movie.id}
                  className="mobile-search-result"
                  type="button"
                  onClick={() => openMovie(movie.slug)}
                >
                  <span className="relative h-14 w-10 shrink-0 overflow-hidden rounded-[10px] bg-white/10">
                    <MovieImage
                      src={movie.posterUrl}
                      alt={movie.title}
                      fallback="poster"
                      fill
                      sizes="40px"
                      className="object-cover"
                    />
                  </span>
                  <span className="min-w-0 flex-1 text-left">
                    <span className="block truncate text-sm font-bold tracking-[-0.006em] text-white">
                      {movie.title}
                    </span>
                    <span className="mt-0.5 block truncate text-xs font-medium tracking-[0.004em] text-zinc-400">
                      {getMovieMeta(movie)}
                    </span>
                    {movie.genres[0] ? (
                      <span className="mt-0.5 block truncate text-[11px] font-semibold tracking-[0.006em] text-[rgba(217,183,111,0.82)]">
                        {movie.genres.slice(0, 2).join(" · ")}
                      </span>
                    ) : null}
                  </span>
                </button>
              ))
            ) : (
              <div className="mobile-search-state">Ештеңе табылмады</div>
            )}
          </div>
        ) : null}
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
          <SiteLogo
            href="/"
            className="mobile-nav-drawer-brand"
            variant="drawer"
            markClassName="h-11 w-[66px] rounded-[18px] p-0.5"
            onClick={() => setOpen(false)}
          />
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
                <UserAvatar
                  avatarUrl={avatarUrl}
                  displayName={displayName}
                  className="h-7 w-7"
                  sizes="28px"
                />
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
