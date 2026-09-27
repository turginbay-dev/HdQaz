import { processingRequest } from "@/features/processing/http";
export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export function GET(request: Request) { return processingRequest(request, "list"); }
export function POST(request: Request) { return processingRequest(request, "create"); }
