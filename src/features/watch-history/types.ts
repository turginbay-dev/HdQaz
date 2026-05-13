import type { MovieRecord } from "@/types/backend";

export type WatchHistoryRecord = {
  id: string;
  userId: string | null;
  contentId: string;
  progressSeconds: number;
  durationSeconds: number;
  progressPercent: number;
  lastPositionSeconds: number;
  completed: boolean;
  lastWatchedAt: string;
  createdAt: string;
  updatedAt: string;
};

export type ContinueWatchingItem = WatchHistoryRecord & {
  movie: MovieRecord;
  remainingSeconds: number | null;
};

export type RecommendationItem = {
  movie: MovieRecord;
  reason: string;
  score: number;
};

export type RecommendationResult = {
  items: RecommendationItem[];
  personalized: boolean;
};
