import type { MovieCatalogId } from "@/lib/movie-taxonomy";

export type MovieLocalization =
  | "Қазақша дыбыстама"
  | "Қазақша субтитрмен"
  | "AI қазақша субтитр"
  | "Дыбыстама күтілуде";

export type Movie = {
  id: string;
  slug: string;
  title: string;
  originalTitle: string;
  year: number;
  runtime: string;
  rating: string;
  description: string;
  posterUrl: string;
  backdropUrl: string;
  badges: MovieLocalization[];
  genres: string[];
  catalogs: MovieCatalogId[];
  isPremium: boolean;
  isNewRelease: boolean;
  streams: {
    master: string;
  };
};
