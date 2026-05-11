import { requireAdmin } from "@/lib/api/auth";
import { getSearchBoolean, readJsonObject } from "@/lib/api/request";
import { handleApiError, noContent, notFound, ok, validationError } from "@/lib/api/responses";
import { deleteMovie, getMovieBySlug, updateMovie } from "@/features/movies/repository";
import { parseMovieInput } from "@/features/movies/validation";

type MovieRouteContext = {
  params: Promise<{
    slug: string;
  }>;
};

export async function GET(request: Request, context: MovieRouteContext) {
  try {
    const { slug } = await context.params;
    const { searchParams } = new URL(request.url);
    const includeDrafts = getSearchBoolean(searchParams, "includeDrafts") ?? false;

    if (includeDrafts) {
      await requireAdmin(request);
    }

    const movie = await getMovieBySlug(slug, { includeDrafts });

    if (!movie) {
      return notFound("Movie not found.");
    }

    return ok(movie);
  } catch (error) {
    return handleApiError(error);
  }
}

export async function PATCH(request: Request, context: MovieRouteContext) {
  try {
    await requireAdmin(request);

    const { slug } = await context.params;
    const payload = await readJsonObject(request);
    const parsed = parseMovieInput(payload, { partial: true });

    if (parsed.errors) {
      return validationError(parsed.errors);
    }

    return ok(await updateMovie(slug, parsed.data));
  } catch (error) {
    return handleApiError(error);
  }
}

export async function DELETE(request: Request, context: MovieRouteContext) {
  try {
    await requireAdmin(request);

    const { slug } = await context.params;
    const deleted = await deleteMovie(slug);

    if (!deleted) {
      return notFound("Movie not found.");
    }

    return noContent();
  } catch (error) {
    return handleApiError(error);
  }
}
