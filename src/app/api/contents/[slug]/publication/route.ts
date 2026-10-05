import { requireSameOrigin } from "@/features/processing/auth";
import { requireAdmin } from "@/lib/api/auth";
import { readJsonObject } from "@/lib/api/request";
import { handleApiError, ok, validationError } from "@/lib/api/responses";
import { unpublishContent } from "@/features/content/repository";
export async function POST(request: Request, context: {params:Promise<{slug:string}>}) {
  try {
    requireSameOrigin(request); await requireAdmin(request);
    const payload=await readJsonObject(request);
    if(payload.isPublished!==false || typeof payload.expectedUpdatedAt!=="string" || !Number.isFinite(Date.parse(payload.expectedUpdatedAt)))
      return validationError({publication:"Контентті жаңартыңыз."});
    return ok(await unpublishContent((await context.params).slug,payload.expectedUpdatedAt));
  } catch(error) {return handleApiError(error);}
}
