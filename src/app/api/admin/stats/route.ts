import { requireAdmin } from "@/lib/api/auth";
import { handleApiError, ok } from "@/lib/api/responses";
import { isEpisodicContent } from "@/features/content/format";
import { listContents } from "@/features/content/repository";
import { listContentRequests } from "@/features/requests/repository";

export async function GET(request: Request) {
  try {
    await requireAdmin(request);

    const [contents, requests] = await Promise.all([
      listContents({ includeDrafts: true, limit: 1000 }),
      listContentRequests()
    ]);

    return ok({
      contents: {
        total: contents.length,
        published: contents.filter((content) => content.isPublished).length,
        drafts: contents.filter((content) => !content.isPublished).length,
        episodic: contents.filter((content) => isEpisodicContent(content)).length
      },
      requests: {
        total: requests.length,
        ready: requests.filter((item) => item.status === "ready").length,
        inProgress: requests.filter((item) => item.status === "in_progress").length,
        votes: requests.reduce((sum, item) => sum + item.votes, 0)
      }
    });
  } catch (error) {
    return handleApiError(error);
  }
}
