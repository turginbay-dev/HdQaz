import { requireAdmin } from "@/lib/api/auth";
import { readJsonObject } from "@/lib/api/request";
import { handleApiError, ok, validationError } from "@/lib/api/responses";
import { updateDubber } from "@/features/content/repository";
import { parseDubberInput } from "@/features/content/validation";

type DubberRouteContext = {
  params: Promise<{
    id: string;
  }>;
};

export async function PATCH(request: Request, context: DubberRouteContext) {
  try {
    await requireAdmin(request);

    const { id } = await context.params;
    const payload = await readJsonObject(request);
    const parsed = parseDubberInput(payload);

    if (parsed.errors) {
      return validationError(parsed.errors);
    }

    return ok(await updateDubber(id, parsed.data));
  } catch (error) {
    return handleApiError(error);
  }
}
