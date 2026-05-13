import { getAuthContext } from "@/lib/api/auth";
import { readJsonObject } from "@/lib/api/request";
import { handleApiError, ok, validationError } from "@/lib/api/responses";
import { recordMovieView } from "@/features/engagement/repository";
import { parseViewInput } from "@/features/engagement/validation";

export async function POST(request: Request) {
  try {
    const context = await getAuthContext(request);
    const payload = await readJsonObject(request);
    const parsed = parseViewInput(payload);

    if (parsed.errors) {
      return validationError(parsed.errors);
    }

    return ok(
      await recordMovieView({
        movieSlug: parsed.data.movieSlug,
        sessionId: parsed.data.sessionId,
        userId: context.user?.id ?? null
      })
    );
  } catch (error) {
    return handleApiError(error);
  }
}
