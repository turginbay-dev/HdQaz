import { NextResponse } from "next/server";
import { listDubbers } from "@/features/content/repository";

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
