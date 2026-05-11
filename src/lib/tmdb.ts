const TMDB_BASE_URL = "https://api.themoviedb.org/3";
const TMDB_IMAGE_BASE_URL = "https://image.tmdb.org/t/p";

type TmdbMovieResult = {
  id: number;
  title?: string;
  name?: string;
  overview?: string;
  poster_path?: string | null;
  backdrop_path?: string | null;
  release_date?: string;
  vote_average?: number;
};

type TmdbSearchResponse = {
  results: TmdbMovieResult[];
};

function getTmdbHeaders() {
  const token = process.env.TMDB_ACCESS_TOKEN;

  if (!token) {
    throw new Error("TMDB_ACCESS_TOKEN is not configured");
  }

  return {
    Authorization: `Bearer ${token}`,
    "Content-Type": "application/json"
  };
}

export function tmdbImage(path: string | null | undefined, size = "w780") {
  if (!path) {
    return null;
  }

  return `${TMDB_IMAGE_BASE_URL}/${size}${path}`;
}

export async function searchTmdbMovies(query: string) {
  if (!query.trim()) {
    return [];
  }

  const params = new URLSearchParams({
    query,
    include_adult: "false",
    language: "kk-KZ"
  });

  const response = await fetch(`${TMDB_BASE_URL}/search/movie?${params.toString()}`, {
    headers: getTmdbHeaders(),
    next: {
      revalidate: 60 * 60
    }
  });

  if (!response.ok) {
    throw new Error(`TMDB search failed: ${response.status}`);
  }

  const data = (await response.json()) as TmdbSearchResponse;

  return data.results.map((movie) => ({
    tmdbId: movie.id,
    title: movie.title ?? movie.name ?? "Untitled",
    description: movie.overview ?? "",
    posterUrl: tmdbImage(movie.poster_path, "w500"),
    backdropUrl: tmdbImage(movie.backdrop_path, "original"),
    year: movie.release_date ? Number(movie.release_date.slice(0, 4)) : null,
    rating: movie.vote_average ? movie.vote_average.toFixed(1) : null
  }));
}
