import { Suspense } from "react";
import type { Metadata } from "next";
import { HeroBanner } from "@/components/home/hero-banner";
import { MovieRow } from "@/components/movie/movie-row";
import { ContinueWatching } from "@/components/home/continue-watching";
import { AiRecommendations } from "@/components/home/ai-recommendations";
import { TopTenRow } from "@/components/home/top-ten-row";
import { AdminShortcut } from "@/components/home/admin-shortcut";
import { getViewerContext } from "@/features/users/session";
import { getMyWatchHistory, getRecommendationsForUser } from "@/features/watch-history/repository";
import {
  getAllMovies,
  getAnimeMovies,
  getCartoonMovies,
  getDoramaMovies,
  getDubbedMovies,
  getFeatureMovies,
  getHeroMovies,
  getSubtitleMovies,
  getTopTenMovies
} from "@/features/movies/queries";
import { getCanonicalUrl } from "@/lib/site-url";
import type { Movie } from "@/types/movie";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  alternates: {
    canonical: getCanonicalUrl("/")
  },
  openGraph: {
    url: getCanonicalUrl("/")
  }
};

function prioritizeUnseen(movies: Movie[], seenIds: Set<string>) {
  const unseen = movies.filter((movie) => !seenIds.has(movie.id));
  const repeated = movies.filter((movie) => seenIds.has(movie.id));

  unseen.forEach((movie) => seenIds.add(movie.id));

  return [...unseen, ...repeated];
}

export default async function HomePage() {
  const [movies, viewer] = await Promise.all([getAllMovies(), getViewerContext()]);
  const heroMovies = getHeroMovies(movies);
  const rowSeenIds = new Set<string>();
  const homepageRows: Array<{
    href: { pathname: string; query: Record<string, string> };
    movies: Movie[];
    title: string;
  }> = [
    {
      title: "Қазақша дыбыстама",
      href: { pathname: "/catalog", query: { catalog: "kazakh-dubbed" } },
      movies: prioritizeUnseen(getDubbedMovies(movies), rowSeenIds)
    },
    {
      title: "Қазақша субтитрмен",
      href: { pathname: "/catalog", query: { catalog: "kazakh-subtitles" } },
      movies: prioritizeUnseen(getSubtitleMovies(movies), rowSeenIds)
    },
    {
      title: "Дорамалар",
      href: { pathname: "/catalog", query: { type: "dorama" } },
      movies: prioritizeUnseen(getDoramaMovies(movies), rowSeenIds)
    },
    {
      title: "Фильмдер",
      href: { pathname: "/catalog", query: { type: "movie" } },
      movies: prioritizeUnseen(getFeatureMovies(movies), rowSeenIds)
    },
    {
      title: "Аниме",
      href: { pathname: "/catalog", query: { type: "anime" } },
      movies: prioritizeUnseen(getAnimeMovies(movies), rowSeenIds)
    },
    {
      title: "Мультфильмдер",
      href: { pathname: "/catalog", query: { type: "cartoon" } },
      movies: prioritizeUnseen(getCartoonMovies(movies), rowSeenIds)
    }
  ];

  return (
    <main className="ambient-page">
      <HeroBanner movies={heroMovies} />
      <div className="home-content-flow">
        <div className="mx-auto flex w-full max-w-7xl flex-col gap-10 px-4 pb-24 pt-0 sm:px-6 lg:gap-12 lg:px-8">
          {viewer.isAdmin ? <AdminShortcut /> : null}
          {homepageRows.filter((row) => row.movies.length > 0).map((row) => (
            <MovieRow
              key={row.title}
              title={row.title}
              href={row.href}
              movies={row.movies.slice(0, 12)}
              priorityCount={0}
            />
          ))}
          <Suspense fallback={null}><PersonalRows userId={viewer.user?.id} /></Suspense>
          <TopTenRow movies={getTopTenMovies(movies)} />
        </div>
      </div>
    </main>
  );
}

async function PersonalRows({ userId }: { userId?: string }) {
  const [items, recommendations] = await Promise.all([
    userId ? getMyWatchHistory(userId, 10) : Promise.resolve([]),
    getRecommendationsForUser(userId, 10)
  ]);
  return <>{userId ? <ContinueWatching isAuthenticated items={items} /> : null}<AiRecommendations recommendations={recommendations} /></>;
}
