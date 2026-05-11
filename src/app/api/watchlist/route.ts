import { requireUser } from "@/lib/api/auth";
import { readJsonObject } from "@/lib/api/request";
import { created, handleApiError, ok, validationError } from "@/lib/api/responses";
import { getMovieBySlug } from "@/features/movies/repository";
import { addWatchlistItem, listWatchlist } from "@/features/users/repository";
import { parseMovieSlugInput } from "@/features/users/validation";
import { ApiError } from "@/lib/api/errors";

export async function GET(request: Request) {
  try {
    const { user } = await requireUser(request);

    return ok({
      items: await listWatchlist(user.id)
    });
  } catch (error) {
    return handleApiError(error);
  }
}

export async function POST(request: Request) {
  try {
    const { user } = await requireUser(request);
    const payload = await readJsonObject(request);
    const parsed = parseMovieSlugInput(payload);

    if (parsed.errors) {
      return validationError(parsed.errors);
    }

    const movie = await getMovieBySlug(parsed.data.movieSlug);

    if (!movie) {
      throw new ApiError(404, "movie_not_found", "Movie not found.");
    }

    return created(await addWatchlistItem(user.id, parsed.data.movieSlug));
  } catch (error) {
    return handleApiError(error);
  }
}
