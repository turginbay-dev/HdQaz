"use client";
import Link from "next/link";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { Search, X } from "lucide-react";
import { UserAvatar } from "@/components/user/user-avatar";
import { MovieSearchResults, useMovieSearch } from "./movie-search-results";
export function ViewerHeader({ avatarUrl, displayName, isAdmin }: { avatarUrl?: string | null; displayName?: string | null; isAdmin: boolean }) {
  const pathname = usePathname();
  const params = useSearchParams();
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState(params.get("q") ?? "");
  const input = useRef<HTMLInputElement>(null);
  const trigger = useRef<HTMLButtonElement>(null);
  const header = useRef<HTMLElement>(null);
  const search = useMovieSearch(query, open);
  useEffect(() => { setQuery(params.get("q") ?? ""); setOpen(false); }, [pathname, params]);
  useEffect(() => { if (open) input.current?.focus(); }, [open]);
  function close() { setOpen(false); trigger.current?.focus(); }
  return <header ref={header} className="viewer-header" onKeyDown={event => { if (event.key === "Escape") close(); }} onBlur={event => { if (!event.currentTarget.contains(event.relatedTarget)) setOpen(false); }}>
    <a href="#main-content" className="skip-link">Контентке өту</a>
    <div className="viewer-container header-inner">
      <Link href="/" className="viewer-brand" aria-label="HdQaz басты бет">Hd<span>Qaz</span><span className="brand-dot" /></Link>
      <Link href="/catalog" className="header-catalog" aria-current={pathname === "/catalog" ? "page" : undefined}>Каталог</Link>
      <div className="header-spacer" />
      <Link href="/premium" className="header-premium">Premium</Link>
      {isAdmin && <Link href="/admin" className="header-admin" aria-label="Әкімшілік">Басқару</Link>}
      <button ref={trigger} className="icon-button" aria-label={open ? "Іздеуді жабу" : "Іздеу"} aria-expanded={open} aria-controls="header-search" onClick={() => open ? close() : setOpen(true)}>{open ? <X size={20} /> : <Search size={20} />}</button>
      <Link href="/profile" className="icon-button" aria-label="Аккаунт"><UserAvatar avatarUrl={avatarUrl} displayName={displayName} className="h-8 w-8" sizes="32px" /></Link>
    </div>
    {open && <div className="viewer-container header-search" id="header-search">
      <form onSubmit={event => { event.preventDefault(); router.push(query.trim() ? `/catalog?q=${encodeURIComponent(query.trim())}` : "/catalog"); setOpen(false); }}>
        <label className="sr-only" htmlFor="quick-search">Кино іздеу</label>
        <input id="quick-search" ref={input} type="search" placeholder="Атауы немесе жылы" value={query} onChange={event => setQuery(event.target.value)} />
        <button className="primary-button" type="submit">Табу</button>
      </form>
      {!query.trim() && <p className="search-hint">Фильмнің атауын немесе жылын енгізіңіз.</p>}
      <MovieSearchResults loading={search.loading} error={search.error} onRetry={search.retry} results={search.results} query={query} variant="mobile" onSelect={slug => { router.push(`/${slug}`); setOpen(false); }} />
    </div>}
  </header>;
}
