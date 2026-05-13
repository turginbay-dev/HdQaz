import { requireUser } from "@/lib/api/auth";
import { readJsonObject } from "@/lib/api/request";
import { created, handleApiError, ok, validationError } from "@/lib/api/responses";
import { addWatchlistItem, listWatchlist } from "@/features/users/repository";
import { parseMovieSlugInput } from "@/features/users/validation";

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

    return created(await addWatchlistItem(user.id, parsed.data.movieSlug));
  } catch (error) {
    return handleApiError(error);
  }
}
