"use client";

import { useEffect, useRef, useState } from "react";
import Hls from "hls.js";
import { Maximize, Pause, Play, Settings, Volume2 } from "lucide-react";

type HlsPlayerProps = {
  src: string;
  poster: string;
};

export function HlsPlayer({ src, poster }: HlsPlayerProps) {
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const [playing, setPlaying] = useState(false);

  useEffect(() => {
    const video = videoRef.current;

    if (!video) {
      return;
    }

    if (video.canPlayType("application/vnd.apple.mpegurl")) {
      video.src = src;
      return;
    }

    if (Hls.isSupported()) {
      const hls = new Hls({
        enableWorker: true
      });

      hls.loadSource(src);
      hls.attachMedia(video);

      return () => {
        hls.destroy();
      };
    }
  }, [src]);

  async function togglePlayback() {
    const video = videoRef.current;

    if (!video) {
      return;
    }

    if (video.paused) {
      await video.play();
      setPlaying(true);
    } else {
      video.pause();
      setPlaying(false);
    }
  }

  return (
    <section className="relative overflow-hidden rounded-[30px] border border-white/10 bg-black shadow-2xl">
      <video
        ref={videoRef}
        poster={poster}
        className="aspect-video w-full bg-black object-cover"
        playsInline
        onPlay={() => setPlaying(true)}
        onPause={() => setPlaying(false)}
      />

      <div className="pointer-events-none absolute inset-x-0 bottom-0 h-40 bg-gradient-to-t from-black to-transparent" />

      <div className="absolute inset-x-3 bottom-3 sm:inset-x-5 sm:bottom-5">
        <div className="glass flex items-center justify-between gap-3 rounded-full px-3 py-2">
          <div className="flex items-center gap-2">
            <button
              className="flex h-10 w-10 items-center justify-center rounded-full bg-white text-black"
              aria-label={playing ? "Пауза" : "Ойнату"}
              onClick={togglePlayback}
            >
              {playing ? <Pause className="h-4 w-4 fill-current" /> : <Play className="h-4 w-4 fill-current" />}
            </button>
            <div className="hidden items-center gap-2 text-sm text-zinc-300 sm:flex">
              <Volume2 className="h-4 w-4" />
              <span>Қазақша дыбыстама</span>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button className="glass-button rounded-full px-3 py-2 text-xs font-semibold text-white">
              1080p
            </button>
            <button
              className="glass-button flex h-10 w-10 items-center justify-center rounded-full text-white"
              aria-label="Баптаулар"
            >
              <Settings className="h-4 w-4" />
            </button>
            <button
              className="glass-button flex h-10 w-10 items-center justify-center rounded-full text-white"
              aria-label="Толық экран"
            >
              <Maximize className="h-4 w-4" />
            </button>
          </div>
        </div>
      </div>
    </section>
  );
}
