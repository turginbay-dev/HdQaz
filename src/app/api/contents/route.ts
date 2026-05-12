import { requireAdmin } from "@/lib/api/auth";
import { getPagination, getSearchBoolean, getSearchString, readJsonObject } from "@/lib/api/request";
import { created, handleApiError, ok, validationError } from "@/lib/api/responses";
import { createContent, listContents } from "@/features/content/repository";
import { parseContentInput } from "@/features/content/validation";
import type { ContentStatus, ContentType } from "@/types/content";

function getContentTypeParam(value?: string) {
  return value && ["movie", "series", "anime", "dorama"].includes(value) ? value as ContentType : undefined;
}

function getContentStatusParam(value?: string) {
  return value && ["completed", "ongoing", "announced"].includes(value) ? value as ContentStatus : undefined;
}

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const includeDrafts = getSearchBoolean(searchParams, "includeDrafts") ?? false;

    if (includeDrafts) {
      await requireAdmin(request);
    }

    const contents = await listContents({
      ...getPagination(searchParams),
      includeDrafts,
      q: getSearchString(searchParams, "q"),
      status: getContentStatusParam(getSearchString(searchParams, "status")),
      type: getContentTypeParam(getSearchString(searchParams, "type"))
    });

    return ok({
      items: contents,
      count: contents.length
    });
  } catch (error) {
    return handleApiError(error);
  }
}

export async function POST(request: Request) {
  try {
    await requireAdmin(request);

    const payload = await readJsonObject(request);
    const parsed = parseContentInput(payload);

    if (parsed.errors) {
      return validationError(parsed.errors);
    }

    return created(await createContent(parsed.data));
  } catch (error) {
    return handleApiError(error);
  }
}
