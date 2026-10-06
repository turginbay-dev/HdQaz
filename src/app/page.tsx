import { Suspense } from "react";
import Link from "next/link";
import type { Metadata } from "next";
import { MovieRow } from "@/components/movie/movie-row";
import { ContinueWatching } from "@/components/home/continue-watching";
import { getViewerContext } from "@/features/users/session";
import { getMyWatchHistory } from "@/features/watch-history/repository";
import { getAllMovies } from "@/features/movies/queries";
import { getCanonicalUrl } from "@/lib/site-url";
import { selectViewerCategory, viewerCategories } from "@/lib/viewer-catalog";
export const dynamic = "force-dynamic";
export const metadata: Metadata = { alternates: { canonical: getCanonicalUrl("/") }, openGraph: { url: getCanonicalUrl("/") } };
export default async function HomePage() {
  const [movies, viewer] = await Promise.all([getAllMovies(), getViewerContext()]);
  const rows = viewerCategories.map(category => ({ ...category, movies: selectViewerCategory(movies, category.type) })).filter(row => row.movies.length);
  return <main className="viewer-container home-page" id="main-content">
    <h1 className="sr-only">HdQaz — қазақша кино</h1>
    <nav className="category-navigation" aria-label="Контент санаттары">
      {rows.map(row => <Link key={row.type} href={`/catalog?type=${row.type}`}>{row.label}</Link>)}
    </nav>
    <Suspense fallback={null}><PersonalRows userId={viewer.user?.id} /></Suspense>
    <div className="home-sections">{rows.map((row, index) => <MovieRow key={row.type} title={row.label} href={`/catalog?type=${row.type}`} movies={row.movies.slice(0, 6)} priorityCount={index === 0 ? 2 : 0} />)}</div>
    {!rows.length && <p className="empty-state">Контент әзірге жоқ. Кейінірек қайта кіріңіз.</p>}
  </main>;
}
async function PersonalRows({ userId }: { userId?: string }) {
  if (!userId) return null;
  const items = await getMyWatchHistory(userId, 10);
  return <ContinueWatching isAuthenticated items={items} />;
}
