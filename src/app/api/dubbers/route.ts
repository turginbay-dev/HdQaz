import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/api/auth";
import { readJsonObject } from "@/lib/api/request";
import { created, handleApiError, validationError } from "@/lib/api/responses";
import { createDubber, listDubbers } from "@/features/content/repository";
import { parseDubberInput } from "@/features/content/validation";

export async function GET() {
  try {
    const dubbers = await listDubbers();

    return NextResponse.json({
      dubbers: dubbers.map((dubber) => ({
        id: dubber.id,
        name: dubber.name,
        logoUrl: dubber.logoUrl,
        telegramUrl: dubber.telegramUrl,
        vkUrl: dubber.vkUrl
      }))
    });
  } catch {
    return NextResponse.json({ dubbers: [] });
  }
}

export async function POST(request: Request) {
  try {
    await requireAdmin(request);

    const payload = await readJsonObject(request);
    const parsed = parseDubberInput(payload);

    if (parsed.errors) {
      return validationError(parsed.errors);
    }

    return created(await createDubber(parsed.data));
  } catch (error) {
    return handleApiError(error);
  }
}
