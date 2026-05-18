import { requireAdmin } from "@/lib/api/auth";
import { getPagination, getSearchBoolean, getSearchString, readJsonObject } from "@/lib/api/request";
import { created, handleApiError, ok, validationError } from "@/lib/api/responses";
import { createMovie } from "@/features/movies/repository";
import { contentToMovieRecord, listContents } from "@/features/content/repository";
import { selectMoviesByFilters } from "@/features/movies/queries";
import { parseMovieInput } from "@/features/movies/validation";
import type { MovieInput } from "@/types/backend";

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const includeDrafts = getSearchBoolean(searchParams, "includeDrafts") ?? false;

    if (includeDrafts) {
      await requireAdmin(request);
    }

    const pagination = getPagination(searchParams);
    const movies = selectMoviesByFilters((await listContents({ includeDrafts })).map(contentToMovieRecord), {
      catalog: getSearchString(searchParams, "catalog"),
      filter: getSearchString(searchParams, "filter"),
      genre: getSearchString(searchParams, "genre"),
      language: getSearchString(searchParams, "language"),
      q: getSearchString(searchParams, "q"),
      type: getSearchString(searchParams, "type"),
      year: getSearchString(searchParams, "year")
    });
    const items = movies.slice(pagination.offset, pagination.offset + pagination.limit);

    return ok({
      items,
      count: movies.length
    });
  } catch (error) {
    return handleApiError(error);
  }
}

export async function POST(request: Request) {
  try {
    await requireAdmin(request);

    const payload = await readJsonObject(request);
    const parsed = parseMovieInput(payload);

    if (parsed.errors) {
      return validationError(parsed.errors);
    }

    const movie = await createMovie(parsed.data as MovieInput);

    return created(movie);
  } catch (error) {
    return handleApiError(error);
  }
}
