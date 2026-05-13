export type ContentType = "movie" | "series" | "anime" | "dorama";

export type ContentStatus = "completed" | "ongoing" | "announced";

export type Genre = {
  id: string;
  name: string;
  slug: string;
};

export type Dubber = {
  id: string;
  name: string;
  slug: string;
  logoUrl?: string | null;
  description?: string | null;
  telegramUrl?: string | null;
  vkUrl?: string | null;
  supportUrl?: string | null;
  chatUrl?: string | null;
  isActive: boolean;
  createdAt?: string;
};

export type DubberInput = {
  id?: string;
  name: string;
  slug: string;
  logoUrl?: string | null;
  description?: string | null;
  telegramUrl?: string | null;
  vkUrl?: string | null;
  supportUrl?: string | null;
  chatUrl?: string | null;
  isActive?: boolean;
};

export type Episode = {
  id: string;
  contentId: string;
  episodeNumber: number;
  title?: string | null;
  slug: string;
  description?: string | null;
  thumbnailUrl?: string | null;
  hlsUrl: string;
  durationMinutes?: number | null;
  introStartSeconds?: number | null;
  introEndSeconds?: number | null;
  isPublished: boolean;
  createdAt?: string;
  updatedAt?: string;
};

export type Content = {
  id: string;
  title: string;
  slug: string;
  type: ContentType;
  description: string;
  posterUrl: string;
  bannerUrl: string;
  trailerUrl?: string | null;
  country: string;
  year: number;
  status: ContentStatus;
  ageRating?: string | null;
  durationMinutes?: number | null;
  hlsUrl?: string | null;
  introStartSeconds?: number | null;
  introEndSeconds?: number | null;
  dubberId?: string | null;
  dubber?: Dubber | null;
  genres: Genre[];
  episodes: Episode[];
  episodeCount: number;
  isPremium: boolean;
  isPublished: boolean;
  createdAt?: string;
  updatedAt?: string;
};

export type ContentInput = {
  id?: string;
  title: string;
  slug: string;
  type: ContentType;
  description: string;
  posterUrl: string;
  bannerUrl: string;
  trailerUrl?: string | null;
  country: string;
  year: number;
  status: ContentStatus;
  ageRating?: string | null;
  durationMinutes?: number | null;
  hlsUrl?: string | null;
  introStartSeconds?: number | null;
  introEndSeconds?: number | null;
  dubberId?: string | null;
  genreIds: string[];
  isPremium?: boolean;
  isPublished?: boolean;
};

export type EpisodeInput = {
  id?: string;
  contentId?: string;
  episodeNumber: number;
  title?: string | null;
  slug?: string | null;
  description?: string | null;
  thumbnailUrl?: string | null;
  hlsUrl: string;
  durationMinutes?: number | null;
  introStartSeconds?: number | null;
  introEndSeconds?: number | null;
  isPublished?: boolean;
};
