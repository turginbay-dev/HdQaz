import { requireAdmin } from "@/lib/api/auth";
import { getSearchBoolean, readJsonObject } from "@/lib/api/request";
import { handleApiError, noContent, notFound, ok, validationError } from "@/lib/api/responses";
import { deleteContent, getContentBySlug, updateContent } from "@/features/content/repository";
import { parseContentInput } from "@/features/content/validation";

type ContentRouteContext = {
  params: Promise<{
    slug: string;
  }>;
};

export async function GET(request: Request, context: ContentRouteContext) {
  try {
    const { slug } = await context.params;
    const { searchParams } = new URL(request.url);
    const includeDrafts = getSearchBoolean(searchParams, "includeDrafts") ?? false;

    if (includeDrafts) {
      await requireAdmin(request);
    }

    const content = await getContentBySlug(slug, { includeDrafts });

    if (!content) {
      return notFound("Content not found.");
    }

    return ok(content);
  } catch (error) {
    return handleApiError(error);
  }
}

export async function PATCH(request: Request, context: ContentRouteContext) {
  try {
    await requireAdmin(request);

    const { slug } = await context.params;
    const payload = await readJsonObject(request);
    const parsed = parseContentInput(payload);

    if (parsed.errors) {
      return validationError(parsed.errors);
    }

    return ok(await updateContent(slug, parsed.data));
  } catch (error) {
    return handleApiError(error);
  }
}

export async function DELETE(request: Request, context: ContentRouteContext) {
  try {
    await requireAdmin(request);

    const { slug } = await context.params;
    const deleted = await deleteContent(slug);

    if (!deleted) {
      return notFound("Content not found.");
    }

    return noContent();
  } catch (error) {
    return handleApiError(error);
  }
}
