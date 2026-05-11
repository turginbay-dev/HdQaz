import { requireUser } from "@/lib/api/auth";
import { handleApiError, noContent } from "@/lib/api/responses";
import { removeWatchlistItem } from "@/features/users/repository";

type WatchlistRouteContext = {
  params: Promise<{
    movieSlug: string;
  }>;
};

export async function DELETE(request: Request, context: WatchlistRouteContext) {
  try {
    const { user } = await requireUser(request);
    const { movieSlug } = await context.params;

    await removeWatchlistItem(user.id, movieSlug);

    return noContent();
  } catch (error) {
    return handleApiError(error);
  }
}
