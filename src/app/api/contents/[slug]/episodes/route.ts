import { requireAdmin } from "@/lib/api/auth";
import { readJsonObject } from "@/lib/api/request";
import { created, handleApiError, notFound, ok, validationError } from "@/lib/api/responses";
import { createEpisode, getContentBySlug } from "@/features/content/repository";
import { parseEpisodeInput } from "@/features/content/validation";

type EpisodesRouteContext = {
  params: Promise<{
    slug: string;
  }>;
};

export async function GET(request: Request, context: EpisodesRouteContext) {
  try {
    await requireAdmin(request);

    const { slug } = await context.params;
    const content = await getContentBySlug(slug, { includeDrafts: true });

    if (!content) {
      return notFound("Content not found.");
    }

    return ok({
      items: content.episodes,
      count: content.episodes.length
    });
  } catch (error) {
    return handleApiError(error);
  }
}

export async function POST(request: Request, context: EpisodesRouteContext) {
  try {
    await requireAdmin(request);

    const { slug } = await context.params;
    const payload = await readJsonObject(request);
    const parsed = parseEpisodeInput(payload);

    if (parsed.errors) {
      return validationError(parsed.errors);
    }

    return created(await createEpisode(slug, parsed.data));
  } catch (error) {
    return handleApiError(error);
  }
}
