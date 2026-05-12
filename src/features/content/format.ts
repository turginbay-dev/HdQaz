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

export function isEpisodicType(type: ContentType | undefined) {
  return type === "dorama" || type === "series" || type === "anime";
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
