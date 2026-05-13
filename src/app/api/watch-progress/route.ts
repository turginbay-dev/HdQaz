import { requireUser } from "@/lib/api/auth";
import { getSearchString, readJsonObject } from "@/lib/api/request";
import { handleApiError, ok, validationError } from "@/lib/api/responses";
import { getMyWatchHistory, getWatchProgressForContent, upsertWatchProgress } from "@/features/watch-history/repository";
import { parseWatchProgressPayload } from "@/features/watch-history/validation";

function getLimit(params: URLSearchParams) {
  const value = Number(params.get("limit") ?? 10);

  return Number.isFinite(value) ? Math.min(Math.max(Math.trunc(value), 1), 50) : 10;
}

export async function GET(request: Request) {
  try {
    const { user } = await requireUser(request);
    const { searchParams } = new URL(request.url);
    const contentId = getSearchString(searchParams, "contentId");

    if (contentId) {
      return ok({
        item: await getWatchProgressForContent(user.id, contentId)
      });
    }

    return ok({
      items: await getMyWatchHistory(user.id, getLimit(searchParams))
    });
  } catch (error) {
    return handleApiError(error);
  }
}

async function saveProgress(request: Request) {
  const { user } = await requireUser(request);
  const payload = await readJsonObject(request);
  const parsed = parseWatchProgressPayload(payload);

  if (parsed.errors) {
    return validationError(parsed.errors);
  }

  return ok(await upsertWatchProgress(user.id, parsed.data));
}

export async function POST(request: Request) {
  try {
    return await saveProgress(request);
  } catch (error) {
    return handleApiError(error);
  }
}

export async function PUT(request: Request) {
  try {
    return await saveProgress(request);
  } catch (error) {
    return handleApiError(error);
  }
}
