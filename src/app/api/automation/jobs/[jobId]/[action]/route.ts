import { processingRequest } from "@/features/processing/http";
export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export async function POST(request: Request, context: { params: Promise<{ jobId: string; action: string }> }) {
  const { jobId, action } = await context.params;
  return processingRequest(request, ["heartbeat", "complete", "fail", "retry", "cancel", "hide"].includes(action) ? action : "unknown", jobId);
}
