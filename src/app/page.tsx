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
import type { Movie } from "@/types/movie";

export const dynamic = "force-dynamic";

function prioritizeUnseen(movies: Movie[], seenIds: Set<string>) {
  const unseen = movies.filter((movie) => !seenIds.has(movie.id));
  const repeated = movies.filter((movie) => seenIds.has(movie.id));

  unseen.forEach((movie) => seenIds.add(movie.id));

  return [...unseen, ...repeated];
}

export default async function HomePage() {
  const [movies, viewer] = await Promise.all([getAllMovies(), getViewerContext()]);
  const [continueWatchingItems, recommendations] = await Promise.all([
    viewer.user ? getMyWatchHistory(viewer.user.id, 10) : Promise.resolve([]),
    getRecommendationsForUser(viewer.user?.id, 10)
  ]);
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
      href: { pathname: "/catalog", query: { genre: "Анимация" } },
      movies: prioritizeUnseen(getCartoonMovies(movies), rowSeenIds)
    }
  ];

  return (
    <main className="ambient-page">
      <HeroBanner movies={heroMovies} />
      <div className="home-content-flow">
        <div className="mx-auto flex w-full max-w-7xl flex-col gap-14 px-4 pb-24 pt-0 sm:px-6 lg:gap-18 lg:px-8">
          {viewer.user ? <ContinueWatching isAuthenticated={Boolean(viewer.user)} items={continueWatchingItems} /> : null}
          {viewer.isAdmin ? <AdminShortcut /> : null}
          <AiRecommendations recommendations={recommendations} />
          {homepageRows.map((row, index) => (
            <MovieRow
              key={row.title}
              title={row.title}
              href={row.href}
              movies={row.movies}
              priorityCount={index === 0 ? 3 : 0}
            />
          ))}
          <TopTenRow movies={getTopTenMovies(movies)} />
        </div>
      </div>
    </main>
  );
}
