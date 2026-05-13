import { requireUser } from "@/lib/api/auth";
import { readJsonObject } from "@/lib/api/request";
import { created, handleApiError, validationError } from "@/lib/api/responses";
import { createMovieComment } from "@/features/engagement/repository";
import { parseCommentInput } from "@/features/engagement/validation";
import { getOrCreateProfile } from "@/features/users/repository";

export async function POST(request: Request) {
  try {
    const { user } = await requireUser(request);
    await getOrCreateProfile(user);

    const payload = await readJsonObject(request);
    const parsed = parseCommentInput(payload);

    if (parsed.errors) {
      return validationError(parsed.errors);
    }

    return created(
      await createMovieComment({
        ...parsed.data,
        userId: user.id
      })
    );
  } catch (error) {
    return handleApiError(error);
  }
}
