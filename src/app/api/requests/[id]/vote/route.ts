import { requireUser } from "@/lib/api/auth";
import { handleApiError, notFound, ok } from "@/lib/api/responses";
import { getContentRequest, removeRequestVote, voteForRequest } from "@/features/requests/repository";

type VoteRouteContext = {
  params: Promise<{
    id: string;
  }>;
};

export async function POST(request: Request, context: VoteRouteContext) {
  try {
    const { user } = await requireUser(request);
    const { id } = await context.params;

    if (!(await getContentRequest(id))) {
      return notFound("Content request not found.");
    }

    return ok(await voteForRequest(id, user.id));
  } catch (error) {
    return handleApiError(error);
  }
}

export async function DELETE(request: Request, context: VoteRouteContext) {
  try {
    const { user } = await requireUser(request);
    const { id } = await context.params;

    if (!(await getContentRequest(id))) {
      return notFound("Content request not found.");
    }

    return ok(await removeRequestVote(id, user.id));
  } catch (error) {
    return handleApiError(error);
  }
}
