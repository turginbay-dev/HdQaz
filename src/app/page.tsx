import { HeroBanner } from "@/components/home/hero-banner";
import { CategoryRail } from "@/components/home/category-rail";
import { MovieRow } from "@/components/movie/movie-row";
import { SpotlightPicker } from "@/components/spotlight/spotlight-picker";
import { ContinueWatching } from "@/components/home/continue-watching";
import { AiRecommendations } from "@/components/home/ai-recommendations";
import { TopTenRow } from "@/components/home/top-ten-row";
import { AdminShortcut } from "@/components/home/admin-shortcut";
import { getViewerContext } from "@/features/users/session";
import { getMyWatchHistory, getRecommendationsForUser } from "@/features/watch-history/repository";
import {
  getAllMovies,
  getDubbedMovies,
  getFeaturedMovie,
  getMoviesByGenre,
  getNewReleases,
  getSubtitleMovies,
  getTopTenMovies,
  getTrendingMovies
} from "@/features/movies/queries";

export const dynamic = "force-dynamic";

export default async function HomePage() {
  const [movies, viewer] = await Promise.all([getAllMovies(), getViewerContext()]);
  const [continueWatchingItems, recommendations] = await Promise.all([
    viewer.user ? getMyWatchHistory(viewer.user.id, 10) : Promise.resolve([]),
    getRecommendationsForUser(viewer.user?.id, 8)
  ]);
  const featured = getFeaturedMovie(movies);

  return (
    <main className="ambient-page">
      <HeroBanner movie={featured} />
      <div className="mx-auto flex w-full max-w-7xl flex-col gap-14 px-4 pb-24 pt-3 sm:px-6 lg:gap-18 lg:px-8">
        {viewer.isAdmin ? <AdminShortcut /> : null}
        <CategoryRail />
        <ContinueWatching isAuthenticated={Boolean(viewer.user)} items={continueWatchingItems} />
        <SpotlightPicker movies={getTrendingMovies(movies)} />
        <AiRecommendations recommendations={recommendations} />
        <MovieRow title="Трендте" movies={getTrendingMovies(movies)} />
        <TopTenRow movies={getTopTenMovies(movies)} />
        <MovieRow
          title="Қазақша дыбыстама"
          href={{ pathname: "/catalog", query: { catalog: "kazakh-dubbed" } }}
          movies={getDubbedMovies(movies)}
        />
        <MovieRow
          title="Қазақша субтитрмен"
          href={{ pathname: "/catalog", query: { catalog: "kazakh-subtitles" } }}
          movies={getSubtitleMovies(movies)}
        />
        <MovieRow
          title="Фантастика"
          href={{ pathname: "/catalog", query: { genre: "Фантастика" } }}
          movies={getMoviesByGenre(movies, "Фантастика")}
        />
        <MovieRow
          title="Драма"
          href={{ pathname: "/catalog", query: { genre: "Драма" } }}
          movies={getMoviesByGenre(movies, "Драма")}
        />
        <MovieRow
          title="Жаңа релиздер"
          href={{ pathname: "/catalog", query: { catalog: "new-releases" } }}
          movies={getNewReleases(movies)}
        />
      </div>
    </main>
  );
}
