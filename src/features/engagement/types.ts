export type PublicProfileSummary = {
  id: string;
  avatarUrl?: string | null;
  defaultAvatarKey?: string | null;
  displayName: string;
};

export type MovieComment = {
  id: string;
  movieId: string;
  userId: string;
  parentId?: string | null;
  body: string;
  isSpoiler: boolean;
  isHidden: boolean;
  hiddenReason?: string | null;
  createdAt: string;
  updatedAt: string;
  author: PublicProfileSummary;
};

export type EngagementState = {
  isLiked: boolean;
  isWatchlisted: boolean;
};

export type EngagementStats = {
  comments: number;
  likes: number;
  views: number;
  watchlist: number;
};
