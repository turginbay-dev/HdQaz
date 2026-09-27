import { processingRequest } from "@/features/processing/http";
export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export function POST(request: Request) { return processingRequest(request, "claim"); }
