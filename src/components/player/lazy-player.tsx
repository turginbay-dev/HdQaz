"use client";
import { LoadingSpinner } from "@/components/ui/loading-spinner";

import dynamic from "next/dynamic";
export const HlsPlayer = dynamic(() => import("./hls-player").then((module) => module.HlsPlayer), {
  ssr: false,
  loading: () => <div className="flex aspect-video w-full items-center justify-center rounded-[18px] bg-black text-sm text-zinc-300" ><LoadingSpinner label="Видео жүктелуде…" /></div>
});
