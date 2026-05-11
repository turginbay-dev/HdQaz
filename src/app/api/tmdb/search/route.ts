import { ApiError } from "@/lib/api/errors";
import { getSearchString } from "@/lib/api/request";
import { fail, handleApiError, ok } from "@/lib/api/responses";
import { searchTmdbMovies } from "@/lib/tmdb";

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const query = getSearchString(searchParams, "q") ?? getSearchString(searchParams, "query");

    if (!query) {
      throw new ApiError(400, "missing_query", "Query parameter q is required.");
    }

    const results = await searchTmdbMovies(query);

    return ok({
      items: results,
      count: results.length
    });
  } catch (error) {
    if (error instanceof Error && error.message.includes("TMDB_ACCESS_TOKEN")) {
      return fail(503, "tmdb_not_configured", "TMDB_ACCESS_TOKEN is not configured.");
    }

    return handleApiError(error);
  }
}
