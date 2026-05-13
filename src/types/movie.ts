import type { MovieCatalogId, MovieLanguageId } from "@/lib/movie-taxonomy";
import type { ContentStatus, ContentType, Dubber, Episode, Genre } from "@/types/content";

export type MovieLocalization =
  | "Қазақша дыбыстама"
  | "Қазақша субтитрмен";

export type Movie = {
  id: string;
  slug: string;
  title: string;
  originalTitle: string;
  type?: ContentType;
  year: number;
  runtime: string;
  rating: string;
  description: string;
  posterUrl: string;
  backdropUrl: string;
  bannerUrl?: string;
  trailerUrl?: string | null;
  country?: string;
  status?: ContentStatus;
  ageRating?: string | null;
  durationMinutes?: number | null;
  hlsUrl?: string | null;
  introStartSeconds?: number | null;
  introEndSeconds?: number | null;
  dubberId?: string | null;
  dubber?: Dubber | null;
  contentGenres?: Genre[];
  episodes?: Episode[];
  episodeCount?: number;
  isPublished?: boolean;
  badges: string[];
  languages: MovieLanguageId[];
  genres: string[];
  catalogs: MovieCatalogId[];
  isPremium: boolean;
  isNewRelease: boolean;
  streams: {
    master: string;
  };
};
