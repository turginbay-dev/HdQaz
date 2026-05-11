import { movieCatalogs, movieGenres, type MovieCatalogId } from "@/lib/movie-taxonomy";
import type { MovieLocalization } from "@/types/movie";
import type { MovieInput } from "@/types/backend";

type ValidationResult<T> =
  | {
      data: T;
      errors: null;
    }
  | {
      data: null;
      errors: Record<string, string>;
    };

const localizations: MovieLocalization[] = [
  "Қазақша дыбыстама",
  "Қазақша субтитрмен",
  "AI қазақша субтитр",
  "Дыбыстама күтілуде"
];

const catalogIds = new Set<string>(movieCatalogs.map((catalog) => catalog.id));
const genreIds = new Set<string>(movieGenres);

function asString(value: unknown) {
  return typeof value === "string" ? value.trim() : undefined;
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

function validateSlug(value: string) {
  return /^[a-z0-9а-яәғқңөұүһі-]+$/i.test(value);
}

function requiredString(
  source: Record<string, unknown>,
  key: string,
  errors: Record<string, string>,
  partial: boolean
) {
  const value = asString(source[key]);

  if (!value && !partial) {
    errors[key] = "Required.";
  }

  return value;
}

export function parseMovieInput(
  payload: Record<string, unknown>,
  options: { partial?: boolean } = {}
): ValidationResult<Partial<MovieInput>> {
  const partial = options.partial ?? false;
  const errors: Record<string, string> = {};
  const streams = payload.streams && typeof payload.streams === "object" && !Array.isArray(payload.streams)
    ? (payload.streams as Record<string, unknown>)
    : {};

  const data: Partial<MovieInput> = {};
  const stringFields = [
    "slug",
    "title",
    "originalTitle",
    "runtime",
    "rating",
    "description",
    "posterUrl",
    "backdropUrl"
  ] as const;

  for (const field of stringFields) {
    const value = requiredString(payload, field, errors, partial);

    if (value) {
      data[field] = value;
    }
  }

  const year = asNumber(payload.year);
  if (year !== undefined) {
    const currentYear = new Date().getFullYear();

    if (!Number.isInteger(year) || year < 1888 || year > currentYear + 5) {
      errors.year = "Must be a valid movie release year.";
    } else {
      data.year = year;
    }
  } else if (!partial) {
    errors.year = "Required.";
  }

  const tmdbId = asNumber(payload.tmdbId);
  if (tmdbId !== undefined) {
    if (!Number.isInteger(tmdbId) || tmdbId <= 0) {
      errors.tmdbId = "Must be a positive integer.";
    } else {
      data.tmdbId = tmdbId;
    }
  } else if (payload.tmdbId === null) {
    data.tmdbId = null;
  }

  const badges = asStringArray(payload.badges);
  if (badges) {
    const invalid = badges.find((badge) => !localizations.includes(badge as MovieLocalization));
    if (invalid) {
      errors.badges = `Unsupported localization: ${invalid}.`;
    } else {
      data.badges = badges as MovieLocalization[];
    }
  } else if (!partial) {
    errors.badges = "Required.";
  }

  const genres = asStringArray(payload.genres);
  if (genres) {
    const invalid = genres.find((genre) => !genreIds.has(genre));
    if (invalid) {
      errors.genres = `Unsupported genre: ${invalid}.`;
    } else if (genres.length === 0) {
      errors.genres = "At least one genre is required.";
    } else {
      data.genres = genres;
    }
  } else if (!partial) {
    errors.genres = "Required.";
  }

  const catalogs = asStringArray(payload.catalogs);
  if (catalogs) {
    const invalid = catalogs.find((catalog) => !catalogIds.has(catalog));
    if (invalid) {
      errors.catalogs = `Unsupported catalog: ${invalid}.`;
    } else if (catalogs.length === 0) {
      errors.catalogs = "At least one catalog is required.";
    } else {
      data.catalogs = catalogs as MovieCatalogId[];
    }
  } else if (!partial) {
    errors.catalogs = "Required.";
  }

  const streamMaster = asString(streams.master) ?? asString(payload.streamMaster);
  if (streamMaster) {
    if (!isValidAssetUrl(streamMaster)) {
      errors.streams = "Master stream must be a valid URL or app-relative path.";
    } else {
      data.streams = {
        master: streamMaster
      };
    }
  } else if (!partial) {
    errors.streams = "Required.";
  }

  for (const field of ["posterUrl", "backdropUrl"] as const) {
    const value = data[field];
    if (value && !isValidAssetUrl(value)) {
      errors[field] = "Must be a valid URL or app-relative path.";
    }
  }

  if (data.slug && !validateSlug(data.slug)) {
    errors.slug = "Use letters, numbers, and dashes only.";
  }

  const isPremium = asBoolean(payload.isPremium);
  if (isPremium !== undefined) {
    data.isPremium = isPremium;
  } else if (!partial) {
    errors.isPremium = "Required.";
  }

  const isNewRelease = asBoolean(payload.isNewRelease);
  if (isNewRelease !== undefined) {
    data.isNewRelease = isNewRelease;
  } else if (!partial) {
    errors.isNewRelease = "Required.";
  }

  const published = asBoolean(payload.published);
  if (published !== undefined) {
    data.published = published;
  }

  const quality = asString(payload.quality);
  if (quality) {
    data.quality = quality;
  }

  if (Object.keys(errors).length > 0) {
    return {
      data: null,
      errors
    };
  }

  return {
    data,
    errors: null
  };
}
