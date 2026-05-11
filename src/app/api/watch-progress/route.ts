import { requireUser } from "@/lib/api/auth";
import { getSearchString, readJsonObject } from "@/lib/api/request";
import { handleApiError, ok, validationError } from "@/lib/api/responses";
import { listWatchProgress, upsertWatchProgress } from "@/features/users/repository";
import { parseWatchProgressInput } from "@/features/users/validation";

export async function GET(request: Request) {
  try {
    const { user } = await requireUser(request);
    const { searchParams } = new URL(request.url);

    return ok({
      items: await listWatchProgress(user.id, getSearchString(searchParams, "movieSlug"))
    });
  } catch (error) {
    return handleApiError(error);
  }
}

async function saveProgress(request: Request) {
  const { user } = await requireUser(request);
  const payload = await readJsonObject(request);
  const parsed = parseWatchProgressInput(payload);

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
