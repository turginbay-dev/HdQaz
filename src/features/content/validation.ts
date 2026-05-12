import { isEpisodicType } from "@/features/content/format";
import type { ContentInput, ContentStatus, ContentType, DubberInput, EpisodeInput } from "@/types/content";

type ValidationResult<T> =
  | {
      data: T;
      errors: null;
    }
  | {
      data: null;
      errors: Record<string, string>;
    };

const contentTypes: ContentType[] = ["movie", "series", "anime", "dorama"];
const contentStatuses: ContentStatus[] = ["completed", "ongoing", "announced"];

function asString(value: unknown) {
  return typeof value === "string" ? value.trim() : undefined;
}

function asNullableString(value: unknown) {
  if (value === null) {
    return null;
  }

  return asString(value);
}

function asBoolean(value: unknown) {
  return typeof value === "boolean" ? value : undefined;
}

function asNumber(value: unknown) {
  if (typeof value === "number" && Number.isFinite(value)) {
    return value;
  }

  if (typeof value === "string" && value.trim()) {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : undefined;
  }

  return undefined;
}

function asStringArray(value: unknown) {
  if (!Array.isArray(value)) {
    return undefined;
  }

  return value.filter((item): item is string => typeof item === "string").map((item) => item.trim()).filter(Boolean);
}

function isValidAssetUrl(value: string) {
  if (value.startsWith("/")) {
    return true;
  }

  try {
    const url = new URL(value);
    return url.protocol === "http:" || url.protocol === "https:";
  } catch {
    return false;
  }
}

function isHlsManifestUrl(value: string) {
  const pathname = value.startsWith("/") ? value : new URL(value).pathname;

  return pathname.toLowerCase().endsWith(".m3u8");
}

function validateSlug(value: string) {
  return /^[a-z0-9а-яәғқңөұүһі-]+$/i.test(value);
}

function requireString(source: Record<string, unknown>, key: string, errors: Record<string, string>) {
  const value = asString(source[key]);

  if (!value) {
    errors[key] = "Required.";
  }

  return value;
}

function optionalUrl(
  source: Record<string, unknown>,
  key: string,
  errors: Record<string, string>
) {
  const value = asNullableString(source[key]);

  if (value && !isValidAssetUrl(value)) {
    errors[key] = "Must be a valid URL or app-relative path.";
  }

  return value ?? null;
}

export function parseContentInput(payload: Record<string, unknown>): ValidationResult<ContentInput> {
  const errors: Record<string, string> = {};
  const type = asString(payload.type) as ContentType | undefined;
  const status = asString(payload.status) as ContentStatus | undefined;
  const year = asNumber(payload.year);
  const durationMinutes = asNumber(payload.durationMinutes);
  const genreIds = asStringArray(payload.genreIds);
  const hlsUrl = asNullableString(payload.hlsUrl);
  const title = requireString(payload, "title", errors);
  const slug = requireString(payload, "slug", errors);
  const description = requireString(payload, "description", errors);
  const posterUrl = requireString(payload, "posterUrl", errors);
  const bannerUrl = requireString(payload, "bannerUrl", errors);
  const country = requireString(payload, "country", errors);

  if (!type || !contentTypes.includes(type)) {
    errors.type = "Unsupported content type.";
  }

  if (!status || !contentStatuses.includes(status)) {
    errors.status = "Unsupported content status.";
  }

  if (slug && !validateSlug(slug)) {
    errors.slug = "Use letters, numbers, and dashes only.";
  }

  if (posterUrl && !isValidAssetUrl(posterUrl)) {
    errors.posterUrl = "Must be a valid URL or app-relative path.";
  }

  if (bannerUrl && !isValidAssetUrl(bannerUrl)) {
    errors.bannerUrl = "Must be a valid URL or app-relative path.";
  }

  const trailerUrl = optionalUrl(payload, "trailerUrl", errors);

  if (year === undefined || !Number.isInteger(year) || year < 1888 || year > new Date().getFullYear() + 10) {
    errors.year = "Must be a valid release year.";
  }

  if (durationMinutes !== undefined && (!Number.isInteger(durationMinutes) || durationMinutes <= 0)) {
    errors.durationMinutes = "Must be a positive whole number.";
  }

  if (!genreIds || genreIds.length === 0) {
    errors.genreIds = "At least one genre is required.";
  }

  if (hlsUrl) {
    if (!isValidAssetUrl(hlsUrl)) {
      errors.hlsUrl = "HLS URL must be a valid URL or app-relative path.";
    } else if (!isHlsManifestUrl(hlsUrl)) {
      errors.hlsUrl = "HLS URL must end with .m3u8.";
    }
  } else if (type === "movie") {
    errors.hlsUrl = "Movie HLS URL is required.";
  }

  if (type && isEpisodicType(type) && hlsUrl) {
    errors.hlsUrl = "Use episodes for dorama, series, and anime streams.";
  }

  if (Object.keys(errors).length > 0) {
    return {
      data: null,
      errors
    };
  }

  return {
    data: {
      title: title ?? "",
      slug: slug ?? "",
      type: type ?? "movie",
      description: description ?? "",
      posterUrl: posterUrl ?? "",
      bannerUrl: bannerUrl ?? "",
      trailerUrl,
      country: country ?? "",
      year: year ?? new Date().getFullYear(),
      status: status ?? "announced",
      ageRating: asNullableString(payload.ageRating) ?? null,
      durationMinutes: durationMinutes ?? null,
      hlsUrl: hlsUrl ?? null,
      dubberId: asNullableString(payload.dubberId) ?? null,
      genreIds: genreIds ?? [],
      isPublished: asBoolean(payload.isPublished) ?? false
    },
    errors: null
  };
}

export function parseDubberInput(payload: Record<string, unknown>): ValidationResult<DubberInput> {
  const errors: Record<string, string> = {};
  const name = requireString(payload, "name", errors);
  const slug = requireString(payload, "slug", errors);

  if (slug && !validateSlug(slug)) {
    errors.slug = "Use letters, numbers, and dashes only.";
  }

  const logoUrl = optionalUrl(payload, "logoUrl", errors);
  const telegramUrl = optionalUrl(payload, "telegramUrl", errors);
  const vkUrl = optionalUrl(payload, "vkUrl", errors);
  const supportUrl = optionalUrl(payload, "supportUrl", errors);
  const chatUrl = optionalUrl(payload, "chatUrl", errors);

  if (Object.keys(errors).length > 0) {
    return {
      data: null,
      errors
    };
  }

  return {
    data: {
      name: name ?? "",
      slug: slug ?? "",
      logoUrl,
      description: asNullableString(payload.description) ?? null,
      telegramUrl,
      vkUrl,
      supportUrl,
      chatUrl,
      isActive: asBoolean(payload.isActive) ?? true
    },
    errors: null
  };
}

export function parseEpisodeInput(payload: Record<string, unknown>): ValidationResult<EpisodeInput> {
  const errors: Record<string, string> = {};
  const episodeNumber = asNumber(payload.episodeNumber);
  const hlsUrl = requireString(payload, "hlsUrl", errors);
  const slug = asNullableString(payload.slug);
  const thumbnailUrl = optionalUrl(payload, "thumbnailUrl", errors);
  const durationMinutes = asNumber(payload.durationMinutes);

  if (episodeNumber === undefined || !Number.isInteger(episodeNumber) || episodeNumber <= 0) {
    errors.episodeNumber = "Episode number must be a positive whole number.";
  }

  if (slug && !validateSlug(slug)) {
    errors.slug = "Use letters, numbers, and dashes only.";
  }

  if (hlsUrl) {
    if (!isValidAssetUrl(hlsUrl)) {
      errors.hlsUrl = "HLS URL must be a valid URL or app-relative path.";
    } else if (!isHlsManifestUrl(hlsUrl)) {
      errors.hlsUrl = "HLS URL must end with .m3u8.";
    }
  }

  if (durationMinutes !== undefined && (!Number.isInteger(durationMinutes) || durationMinutes <= 0)) {
    errors.durationMinutes = "Must be a positive whole number.";
  }

  if (Object.keys(errors).length > 0) {
    return {
      data: null,
      errors
    };
  }

  return {
    data: {
      episodeNumber: episodeNumber ?? 1,
      title: asNullableString(payload.title) ?? null,
      slug: slug || String(episodeNumber ?? 1),
      description: asNullableString(payload.description) ?? null,
      thumbnailUrl,
      hlsUrl: hlsUrl ?? "",
      durationMinutes: durationMinutes ?? null,
      isPublished: asBoolean(payload.isPublished) ?? false
    },
    errors: null
  };
}
