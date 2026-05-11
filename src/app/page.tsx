import { HeroBanner } from "@/components/home/hero-banner";
import { CategoryRail } from "@/components/home/category-rail";
import { MovieRow } from "@/components/movie/movie-row";
import { SpotlightPicker } from "@/components/spotlight/spotlight-picker";
import { ContinueWatching } from "@/components/home/continue-watching";
import { AiRecommendations } from "@/components/home/ai-recommendations";
import { TopTenRow } from "@/components/home/top-ten-row";
import { AdminShortcut } from "@/components/home/admin-shortcut";
import {
  getAiRecommendedMovies,
  getContinueWatchingMovies,
  getDubbedMovies,
  getFeaturedMovie,
  getMoviesByGenre,
  getNewReleases,
  getSubtitleMovies,
  getTopTenMovies,
  getTrendingMovies
} from "@/features/movies/queries";

export default function HomePage() {
  const featured = getFeaturedMovie();

  return (
    <main className="ambient-page">
      <HeroBanner movie={featured} />
      <div className="mx-auto flex w-full max-w-7xl flex-col gap-14 px-4 pb-24 pt-3 sm:px-6 lg:gap-18 lg:px-8">
        <AdminShortcut />
        <CategoryRail />
        <ContinueWatching movies={getContinueWatchingMovies()} />
        <SpotlightPicker movies={getTrendingMovies()} />
        <AiRecommendations movies={getAiRecommendedMovies()} />
        <MovieRow title="Трендте" movies={getTrendingMovies()} />
        <TopTenRow movies={getTopTenMovies()} />
        <MovieRow
          title="Қазақша дыбыстама"
          href={{ pathname: "/catalog", query: { catalog: "kazakh-dubbed" } }}
          movies={getDubbedMovies()}
        />
        <MovieRow
          title="Қазақша субтитрмен"
          href={{ pathname: "/catalog", query: { catalog: "kazakh-subtitles" } }}
          movies={getSubtitleMovies()}
        />
        <MovieRow
          title="Фантастика"
          href={{ pathname: "/catalog", query: { genre: "Фантастика" } }}
          movies={getMoviesByGenre("Фантастика")}
        />
        <MovieRow
          title="Драма"
          href={{ pathname: "/catalog", query: { genre: "Драма" } }}
          movies={getMoviesByGenre("Драма")}
        />
        <MovieRow
          title="Жаңа релиздер"
          href={{ pathname: "/catalog", query: { catalog: "new-releases" } }}
          movies={getNewReleases()}
        />
      </div>
    </main>
  );
}
