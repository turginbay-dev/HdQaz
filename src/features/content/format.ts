import type { ContentStatus, ContentType } from "@/types/content";

export const contentTypeLabels: Record<ContentType, string> = {
  anime: "Anime",
  dorama: "Dorama",
  movie: "Movie",
  series: "Series"
};

export const contentStatusLabels: Record<ContentStatus, string> = {
  announced: "Жақында",
  completed: "Аяқталған",
  ongoing: "Жалғасуда"
};

export type ContentReleaseFormat = "episodic" | "feature";

export const contentReleaseFormatLabels: Record<ContentReleaseFormat, string> = {
  episodic: "Сериялар",
  feature: "Толық метражды"
};

export function canHaveEpisodes(type: ContentType | undefined) {
  return type === "anime" || type === "dorama" || type === "series";
}

export function isEpisodicType(type: ContentType | undefined) {
  return type === "series";
}

export function isEpisodicContent(content: {
  episodeCount?: number | null;
  episodes?: Array<unknown> | null;
  hlsUrl?: string | null;
  type?: ContentType | null;
}) {
  if (!content.type) {
    return false;
  }

  if (isEpisodicType(content.type)) {
    return true;
  }

  if (!canHaveEpisodes(content.type)) {
    return false;
  }

  if (content.hlsUrl) {
    return false;
  }

  return true;
}

export function formatDurationMinutes(value?: number | null) {
  if (!value) {
    return "";
  }

  const hours = Math.floor(value / 60);
  const minutes = value % 60;

  if (hours > 0 && minutes > 0) {
    return `${hours} сағ ${minutes} мин`;
  }

  if (hours > 0) {
    return `${hours} сағ`;
  }

  return `${minutes} мин`;
}

export function formatEpisodeCount(value?: number | null) {
  return value && value > 0 ? `${value} серия` : "";
}

export function slugifyContent(value: string) {
  return value
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9а-яәғқңөұүһі]+/gi, "-")
    .replace(/^-+|-+$/g, "");
}
