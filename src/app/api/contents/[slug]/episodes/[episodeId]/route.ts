import { requireAdmin } from "@/lib/api/auth";
import { readJsonObject } from "@/lib/api/request";
import { handleApiError, noContent, notFound, ok, validationError } from "@/lib/api/responses";
import { deleteEpisode, updateEpisode } from "@/features/content/repository";
import { parseEpisodeInput } from "@/features/content/validation";

type EpisodeRouteContext = {
  params: Promise<{
    episodeId: string;
    slug: string;
  }>;
};

export async function PATCH(request: Request, context: EpisodeRouteContext) {
  try {
    await requireAdmin(request);

    const { episodeId, slug } = await context.params;
    const payload = await readJsonObject(request);
    const parsed = parseEpisodeInput(payload);

    if (parsed.errors) {
      return validationError(parsed.errors);
    }

    return ok(await updateEpisode(slug, episodeId, parsed.data));
  } catch (error) {
    return handleApiError(error);
  }
}

export async function DELETE(request: Request, context: EpisodeRouteContext) {
  try {
    await requireAdmin(request);

    const { episodeId, slug } = await context.params;
    const deleted = await deleteEpisode(slug, episodeId);

    if (!deleted) {
      return notFound("Episode not found.");
    }

    return noContent();
  } catch (error) {
    return handleApiError(error);
  }
}
