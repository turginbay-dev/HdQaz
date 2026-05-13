import { requireUser } from "@/lib/api/auth";
import { handleApiError, ok } from "@/lib/api/responses";
import { removeMovieLike } from "@/features/engagement/repository";

type LikeRouteContext = {
  params: Promise<{
    movieSlug: string;
  }>;
};

export async function DELETE(request: Request, context: LikeRouteContext) {
  try {
    const { user } = await requireUser(request);
    const { movieSlug } = await context.params;

    return ok(await removeMovieLike(user.id, movieSlug));
  } catch (error) {
    return handleApiError(error);
  }
}
