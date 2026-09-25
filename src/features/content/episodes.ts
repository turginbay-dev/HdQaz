import { ApiError } from "@/lib/api/errors";
import type { Content, EpisodeInput } from "@/types/content";

/** Slugs are assigned once. Updating or mapping an existing episode keeps its URL. */
export function prepareEpisode(input: EpisodeInput, content: Content): EpisodeInput {
  if (content.type === "movie") {
    throw new ApiError(400, "invalid_content_type", "Movies do not support episodes.");
  }
  const season = input.seasonId ? content.seasons.find((item) => item.id === input.seasonId) : null;
  if (input.seasonId && !season) {
    throw new ApiError(400, "invalid_season", "Season must belong to this content.");
  }
  return {
    ...input,
    slug: input.slug || (season ? `s${season.seasonNumber}-e${input.episodeNumber}` : String(input.episodeNumber))
  };
}
