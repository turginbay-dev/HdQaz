import { requireUser } from "@/lib/api/auth";
import { getSearchString, readJsonObject } from "@/lib/api/request";
import { created, handleApiError, ok, validationError } from "@/lib/api/responses";
import { createContentRequest, listContentRequests } from "@/features/requests/repository";
import { parseContentRequestInput, parseRequestStatus } from "@/features/requests/validation";

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);

    return ok({
      items: await listContentRequests({
        q: getSearchString(searchParams, "q"),
        status: parseRequestStatus(searchParams.get("status"))
      })
    });
  } catch (error) {
    return handleApiError(error);
  }
}

export async function POST(request: Request) {
  try {
    const { user } = await requireUser(request);
    const payload = await readJsonObject(request);
    const parsed = parseContentRequestInput(payload);

    if (parsed.errors) {
      return validationError(parsed.errors);
    }

    return created(
      await createContentRequest({
        ...parsed.data,
        createdBy: user.id
      })
    );
  } catch (error) {
    return handleApiError(error);
  }
}
