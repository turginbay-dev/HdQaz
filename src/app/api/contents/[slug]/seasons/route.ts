import { requireAdmin } from "@/lib/api/auth";
import { readJsonObject } from "@/lib/api/request";
import { created, handleApiError, validationError } from "@/lib/api/responses";
import { createSeason } from "@/features/content/repository";

export async function POST(request: Request, context: { params: Promise<{ slug: string }> }) {
  try {
    await requireAdmin(request);
    const { slug } = await context.params;
    const payload = await readJsonObject(request);
    const seasonNumber = typeof payload.seasonNumber === "number" ? payload.seasonNumber : NaN;
    if (!Number.isSafeInteger(seasonNumber) || seasonNumber < 1 || seasonNumber > 2147483647) {
      return validationError({ seasonNumber: "Season number must be a positive integer." });
    }
    if (payload.title != null && (typeof payload.title !== "string" || payload.title.length > 200)) {
      return validationError({ title: "Title must be at most 200 characters." });
    }
    return created(await createSeason(slug, seasonNumber, typeof payload.title === "string" ? payload.title.trim() || null : null));
  } catch (error) {
    return handleApiError(error);
  }
}
