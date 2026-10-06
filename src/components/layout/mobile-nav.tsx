"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Search } from "lucide-react";
import { SiteLogo } from "@/components/layout/site-logo";
import { MovieSearchResults, useMovieSearch } from "@/components/layout/movie-search-results";

type MobileNavProps = {
  avatarUrl?: string | null;
  displayName?: string | null;
  isPremium?: boolean;
};

export function MobileNav(_props: MobileNavProps) {
  const [searchOpen, setSearchOpen] = useState(false);
  const [searchValue, setSearchValue] = useState("");
  const router = useRouter();
  const searchParams = useSearchParams();
  const searchInputRef = useRef<HTMLInputElement>(null);
  const currentSearchQuery = searchParams.get("q") ?? "";
  const trimmedSearch = searchValue.trim();
  const search = useMovieSearch(searchValue, searchOpen, 12);

  useEffect(() => {
    setSearchValue(currentSearchQuery);
  }, [currentSearchQuery]);

  useEffect(() => {
    if (searchOpen) {
      window.requestAnimationFrame(() => searchInputRef.current?.focus());
    }
  }, [searchOpen]);

  function openMovie(slug: string) {
    router.push(`/${slug}`);
    setSearchOpen(false);
  }

  function handleSearchSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (search.results[0]) openMovie(search.results[0].slug);
  }

  return (
    <>
      <header className="fixed left-0 right-0 top-0 z-50 flex items-center justify-between px-4 py-4 lg:hidden">
        <SiteLogo href="/" markClassName="h-10 w-16" />
        <button
          className="mobile-nav-icon-button"
          aria-label="Іздеу"
          aria-expanded={searchOpen}
          type="button"
          onClick={() => {
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
        onKeyDown={(event) => { if (event.key === "Escape") setSearchOpen(false); }}
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

        <MovieSearchResults
          loading={search.loading}
          onSelect={openMovie}
          query={trimmedSearch}
          results={search.results}
          variant="mobile"
        />
      </div>

    </>
  );
}
