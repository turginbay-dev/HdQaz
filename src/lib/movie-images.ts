export const MOVIE_BACKDROP_FALLBACK = "/movie-backdrop-fallback.svg";
export const MOVIE_POSTER_FALLBACK = "/movie-poster-fallback.svg";

const tmdbWebImageHosts = new Set(["media.themoviedb.org", "www.themoviedb.org"]);

function normalizeRemoteMovieImageUrl(value: string): string | null {
  try {
    const url = new URL(value);

    if (url.hostname.endsWith("google.com") && url.pathname === "/url") {
      const redirectedUrl = url.searchParams.get("url") ?? url.searchParams.get("q");

      return redirectedUrl ? normalizeMovieImageUrl(redirectedUrl) : null;
    }

    if (tmdbWebImageHosts.has(url.hostname) && url.pathname.startsWith("/t/p/")) {
      url.hostname = "image.tmdb.org";
    }

    if (url.hostname !== "image.tmdb.org") {
      return null;
    }

    return url.toString();
  } catch {
    return null;
  }
}

export function normalizeMovieImageUrl(value?: string | null): string | null {
  const trimmed = value?.trim();

  if (!trimmed) {
    return null;
  }

  if (trimmed.startsWith("/")) {
    return trimmed;
  }

  return normalizeRemoteMovieImageUrl(trimmed);
}

export function getMovieImageFallback(kind: "backdrop" | "poster") {
  return kind === "poster" ? MOVIE_POSTER_FALLBACK : MOVIE_BACKDROP_FALLBACK;
}

export function getMovieImageSrc(value: string | null | undefined, kind: "backdrop" | "poster") {
  return normalizeMovieImageUrl(value) ?? getMovieImageFallback(kind);
}
