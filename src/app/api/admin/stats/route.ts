import { requireAdmin } from "@/lib/api/auth";
import { handleApiError, ok } from "@/lib/api/responses";
import { listMovies } from "@/features/movies/repository";
import { listContentRequests } from "@/features/requests/repository";

export async function GET(request: Request) {
  try {
    await requireAdmin(request);

    const [movies, requests] = await Promise.all([
      listMovies({ includeDrafts: true, limit: 1000 }),
      listContentRequests()
    ]);

    return ok({
      movies: {
        total: movies.length,
        published: movies.filter((movie) => movie.published).length,
        drafts: movies.filter((movie) => !movie.published).length,
        premium: movies.filter((movie) => movie.isPremium).length
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
