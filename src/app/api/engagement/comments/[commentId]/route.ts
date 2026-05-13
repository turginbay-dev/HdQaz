import { requireAdmin, requireUser } from "@/lib/api/auth";
import { readJsonObject } from "@/lib/api/request";
import { handleApiError, noContent, ok, validationError } from "@/lib/api/responses";
import { moderateComment, softDeleteComment } from "@/features/engagement/repository";
import { parseModerationInput } from "@/features/engagement/validation";

type CommentRouteContext = {
  params: Promise<{
    commentId: string;
  }>;
};

export async function DELETE(request: Request, context: CommentRouteContext) {
  try {
    const { user, isAdmin } = await requireUser(request);
    const { commentId } = await context.params;

    await softDeleteComment(commentId, {
      isAdmin,
      userId: user.id
    });

    return noContent();
  } catch (error) {
    return handleApiError(error);
  }
}

export async function PATCH(request: Request, context: CommentRouteContext) {
  try {
    await requireAdmin(request);

    const { commentId } = await context.params;
    const payload = await readJsonObject(request);
    const parsed = parseModerationInput(payload);

    if (parsed.errors) {
      return validationError(parsed.errors);
    }

    return ok(await moderateComment(commentId, parsed.data.action, parsed.data.hiddenReason));
  } catch (error) {
    return handleApiError(error);
  }
}
