import type { Movie } from "@/types/movie";
export type { Content, ContentInput, ContentStatus, ContentType, Dubber, Episode, EpisodeInput, Genre } from "@/types/content";

export type MovieRecord = Movie & {
  tmdbId?: number | null;
  quality?: string;
  published: boolean;
  createdAt?: string;
  updatedAt?: string;
};

export type MovieInput = Omit<Movie, "id"> & {
  id?: string;
  tmdbId?: number | null;
  quality?: string;
  published?: boolean;
};

export type ContentRequestStatus = "requested" | "in_progress" | "ready" | "rejected";

export type ContentRequest = {
  id: string;
  title: string;
  originalTitle?: string | null;
  note?: string | null;
  status: ContentRequestStatus;
  votes: number;
  targetVotes: number;
  createdBy?: string | null;
  createdAt?: string;
  updatedAt?: string;
};

export type UserProfile = {
  id: string;
  email?: string | null;
  displayName?: string | null;
  avatarUrl?: string | null;
  role: "user" | "admin";
  createdAt?: string;
  updatedAt?: string;
};

export type WatchProgress = {
  userId: string;
  movieSlug: string;
  positionSeconds: number;
  durationSeconds: number;
  percent: number;
  completed: boolean;
  updatedAt?: string;
};

export type WatchlistItem = {
  userId: string;
  movieSlug: string;
  createdAt?: string;
};
