"use client";

import { useEffect, useRef, useState } from "react";
import Hls, { type ErrorData, type Level } from "hls.js";
import { Loader2, Maximize, Minimize, Pause, Play, RotateCcw, Volume2, VolumeX } from "lucide-react";
import { formatMovieLanguages } from "@/lib/movie-taxonomy";
import type { MovieLanguageId } from "@/lib/movie-taxonomy";

type HlsPlayerProps = {
  src: string;
  poster: string;
  languages: MovieLanguageId[];
};

type QualityLevel = {
  index: number;
  label: string;
};

function formatTime(value: number) {
  if (!Number.isFinite(value) || value <= 0) {
    return "0:00";
  }

  const totalSeconds = Math.floor(value);
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;

  if (hours > 0) {
    return `${hours}:${String(minutes).padStart(2, "0")}:${String(seconds).padStart(2, "0")}`;
  }

  return `${minutes}:${String(seconds).padStart(2, "0")}`;
}

function formatLevel(level: Level) {
  if (level.height) {
    return `${level.height}p`;
  }

  if (level.name) {
    return level.name;
  }

  return `${Math.round(level.bitrate / 1000)} kbps`;
}

function getBufferedEnd(video: HTMLVideoElement) {
  if (video.buffered.length === 0) {
    return 0;
  }

  const currentTime = video.currentTime;

  for (let index = 0; index < video.buffered.length; index += 1) {
    const start = video.buffered.start(index);
    const end = video.buffered.end(index);

    if (currentTime >= start && currentTime <= end) {
      return end;
    }
  }

  return video.buffered.end(video.buffered.length - 1);
}

export function HlsPlayer({ src, poster, languages }: HlsPlayerProps) {
  const playerRef = useRef<HTMLElement | null>(null);
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const hlsRef = useRef<Hls | null>(null);
  const [playing, setPlaying] = useState(false);
  const [loading, setLoading] = useState(true);
  const [muted, setMuted] = useState(false);
  const [volume, setVolume] = useState(0.86);
  const [duration, setDuration] = useState(0);
  const [currentTime, setCurrentTime] = useState(0);
  const [bufferedEnd, setBufferedEnd] = useState(0);
  const [qualityLevels, setQualityLevels] = useState<QualityLevel[]>([]);
  const [manualLevel, setManualLevel] = useState(-1);
  const [currentLevel, setCurrentLevel] = useState(-1);
  const [fullscreen, setFullscreen] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const progressPercent = duration > 0 ? Math.min(100, (currentTime / duration) * 100) : 0;
  const bufferedPercent = duration > 0 ? Math.min(100, (bufferedEnd / duration) * 100) : 0;

  useEffect(() => {
    const video = videoRef.current;

    if (!video) {
      return;
    }

    setCurrentTime(0);
    setDuration(0);
    setBufferedEnd(0);
    setPlaying(false);
    setLoading(true);
    setError(null);
    setQualityLevels([]);
    setManualLevel(-1);
    setCurrentLevel(-1);
    hlsRef.current = null;
    video.removeAttribute("src");
    video.load();

    if (video.canPlayType("application/vnd.apple.mpegurl")) {
      video.src = src;
      setLoading(false);

      return () => {
        video.removeAttribute("src");
        video.load();
      };
    }

    if (Hls.isSupported()) {
      const hls = new Hls({
        backBufferLength: 90,
        capLevelToPlayerSize: true,
        enableWorker: true,
        lowLatencyMode: true
      });

      hlsRef.current = hls;

      const handleManifestParsed = () => {
        setQualityLevels(hls.levels.map((level, index) => ({ index, label: formatLevel(level) })));
        setLoading(false);
      };

      const handleLevelSwitched = (_event: string, data: { level: number }) => {
        setCurrentLevel(data.level);
      };

      const handleError = (_event: string, data: ErrorData) => {
        if (!data.fatal) {
          return;
        }

        if (data.type === Hls.ErrorTypes.NETWORK_ERROR) {
          setError("HLS желісі үзілді. Қайта қосылып жатыр...");
          hls.startLoad();
          return;
        }

        if (data.type === Hls.ErrorTypes.MEDIA_ERROR) {
          setError("Видео қалпына келтіріліп жатыр...");
          hls.recoverMediaError();
          return;
        }

        setLoading(false);
        setError("HLS stream ашылмады. .m3u8 URL және R2 CORS баптауын тексеріңіз.");
      };

      hls.on(Hls.Events.MANIFEST_PARSED, handleManifestParsed);
      hls.on(Hls.Events.LEVEL_SWITCHED, handleLevelSwitched);
      hls.on(Hls.Events.ERROR, handleError);
      hls.loadSource(src);
      hls.attachMedia(video);

      return () => {
        hls.off(Hls.Events.MANIFEST_PARSED, handleManifestParsed);
        hls.off(Hls.Events.LEVEL_SWITCHED, handleLevelSwitched);
        hls.off(Hls.Events.ERROR, handleError);
        hls.destroy();
        hlsRef.current = null;
        video.removeAttribute("src");
        video.load();
      };
    }

    setLoading(false);
    setError("Бұл браузер HLS stream ойната алмайды.");
  }, [src]);

  useEffect(() => {
    const video = videoRef.current;

    if (!video) {
      return;
    }

    video.volume = volume;
    video.muted = muted;
  }, [muted, volume]);

  useEffect(() => {
    const syncFullscreen = () => {
      setFullscreen(Boolean(document.fullscreenElement));
    };

    document.addEventListener("fullscreenchange", syncFullscreen);

    return () => {
      document.removeEventListener("fullscreenchange", syncFullscreen);
    };
  }, []);

  async function togglePlayback() {
    const video = videoRef.current;

    if (!video) {
      return;
    }

    if (video.paused) {
      try {
        await video.play();
        setPlaying(true);
        setError(null);
      } catch {
        setError("Ойнату басталмады. HLS URL қолжетімді екенін тексеріңіз.");
      }
    } else {
      video.pause();
      setPlaying(false);
    }
  }

  function syncVideoState() {
    const video = videoRef.current;

    if (!video) {
      return;
    }

    setCurrentTime(video.currentTime);
    setDuration(Number.isFinite(video.duration) ? video.duration : 0);
    setBufferedEnd(getBufferedEnd(video));
    setLoading(video.readyState < 3 && !video.paused);
  }

  function seek(value: string) {
    const video = videoRef.current;
    const nextTime = Number(value);

    if (!video || !Number.isFinite(nextTime)) {
      return;
    }

    video.currentTime = nextTime;
    setCurrentTime(nextTime);
  }

  function toggleMute() {
    const video = videoRef.current;

    if (!video) {
      return;
    }

    video.muted = !video.muted;
    setMuted(video.muted);
  }

  function changeVolume(value: string) {
    const nextVolume = Number(value);
    const video = videoRef.current;

    if (!video || !Number.isFinite(nextVolume)) {
      return;
    }

    video.volume = nextVolume;
    video.muted = nextVolume === 0;
    setVolume(nextVolume);
    setMuted(video.muted);
  }

  function changeQuality(value: string) {
    const nextLevel = Number(value);
    const hls = hlsRef.current;

    setManualLevel(nextLevel);

    if (hls && Number.isFinite(nextLevel)) {
      hls.currentLevel = nextLevel;
    }
  }

  async function toggleFullscreen() {
    const player = playerRef.current;

    if (!player) {
      return;
    }

    try {
      if (document.fullscreenElement) {
        await document.exitFullscreen();
      } else {
        await player.requestFullscreen();
      }
    } catch {
      setError("Толық экран режимі іске қосылмады.");
    }
  }

  function retryStream() {
    setError(null);
    setLoading(true);
    hlsRef.current?.startLoad();
    void videoRef.current?.play().catch(() => {
      setLoading(false);
    });
  }

  const qualityLabel =
    manualLevel === -1
      ? currentLevel >= 0
        ? `Auto · ${qualityLevels.find((level) => level.index === currentLevel)?.label ?? "HLS"}`
        : "Auto"
      : qualityLevels.find((level) => level.index === manualLevel)?.label ?? "HLS";

  return (
    <section
      ref={playerRef}
      className="group relative overflow-hidden rounded-[30px] border border-white/[0.14] bg-black shadow-[0_34px_130px_rgba(0,0,0,0.72)]"
    >
      <video
        ref={videoRef}
        poster={poster}
        className="relative z-0 aspect-video w-full bg-black object-contain"
        crossOrigin="anonymous"
        playsInline
        preload="metadata"
        onClick={togglePlayback}
        onDoubleClick={toggleFullscreen}
        onCanPlay={() => {
          setLoading(false);
          syncVideoState();
        }}
        onDurationChange={syncVideoState}
        onLoadedMetadata={syncVideoState}
        onPlay={() => {
          setPlaying(true);
          setLoading(false);
        }}
        onPause={() => setPlaying(false)}
        onProgress={syncVideoState}
        onTimeUpdate={syncVideoState}
        onVolumeChange={() => {
          const video = videoRef.current;

          if (video) {
            setMuted(video.muted);
            setVolume(video.volume);
          }
        }}
        onWaiting={() => setLoading(true)}
      />

      <div className="pointer-events-none absolute inset-0 bg-[linear-gradient(180deg,rgba(0,0,0,0.52)_0%,transparent_28%,transparent_48%,rgba(0,0,0,0.88)_100%)]" />
      <div className="pointer-events-none absolute inset-0 shadow-[inset_0_0_140px_rgba(0,0,0,0.66)]" />

      <div className="absolute left-3 right-3 top-3 flex items-start justify-between gap-3 sm:left-5 sm:right-5 sm:top-5">
        <div className="glass inline-flex max-w-[calc(100%-4rem)] items-center gap-2 rounded-full px-3 py-2 text-xs font-semibold text-white">
          <span className="rounded-full bg-[rgba(217,183,111,0.18)] px-2 py-0.5 text-[var(--accent)]">R2 HLS</span>
          <span className="truncate text-zinc-300">{formatMovieLanguages(languages, "short")}</span>
        </div>
        <div className="glass hidden rounded-full px-3 py-2 text-xs font-semibold text-zinc-200 sm:block">
          {qualityLabel}
        </div>
      </div>

      {loading && !error ? (
        <div className="absolute inset-0 flex items-center justify-center bg-black/20">
          <div className="glass flex h-16 w-16 items-center justify-center rounded-full text-white">
            <Loader2 className="h-6 w-6 animate-spin" />
          </div>
        </div>
      ) : null}

      {!playing && !loading && !error ? (
        <button
          className="glass absolute left-1/2 top-1/2 flex h-20 w-20 -translate-x-1/2 -translate-y-1/2 items-center justify-center rounded-full text-white transition hover:scale-105"
          aria-label="Ойнату"
          onClick={togglePlayback}
          type="button"
        >
          <Play className="ml-1 h-8 w-8 fill-current" />
        </button>
      ) : null}

      {error ? (
        <div className="absolute inset-0 flex items-center justify-center bg-black/62 px-4 backdrop-blur-sm">
          <div className="glass-strong max-w-md rounded-[28px] p-5 text-center">
            <p className="text-sm font-semibold text-white">{error}</p>
            <button
              className="hero-watch-button mt-4 inline-flex min-h-11 items-center gap-2 rounded-full px-5 text-sm font-semibold"
              onClick={retryStream}
              type="button"
            >
              <RotateCcw className="h-4 w-4" />
              Қайта қосу
            </button>
          </div>
        </div>
      ) : null}

      <div className="absolute inset-x-2 bottom-2 sm:inset-x-5 sm:bottom-5">
        <div className="glass-strong rounded-[26px] p-3 sm:rounded-full sm:px-4">
          <div className="relative mb-2 flex h-5 items-center sm:mb-0">
            <div className="absolute left-0 right-0 h-1 overflow-hidden rounded-full bg-white/15">
              <div className="h-full rounded-full bg-white/25" style={{ width: `${bufferedPercent}%` }} />
              <div
                className="absolute inset-y-0 left-0 rounded-full bg-[var(--accent)]"
                style={{ width: `${progressPercent}%` }}
              />
            </div>
            <input
              className="cinema-range relative z-10 w-full"
              aria-label="Көру уақыты"
              type="range"
              min={0}
              max={duration || 0}
              step="0.1"
              value={Math.min(currentTime, duration || currentTime)}
              onChange={(event) => seek(event.target.value)}
            />
          </div>

          <div className="flex items-center gap-2">
            <button
              className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-white text-black transition hover:scale-105"
              aria-label={playing ? "Пауза" : "Ойнату"}
              onClick={togglePlayback}
              type="button"
            >
              {playing ? <Pause className="h-4 w-4 fill-current" /> : <Play className="ml-0.5 h-4 w-4 fill-current" />}
            </button>

            <div className="hidden min-w-[104px] text-xs font-semibold text-zinc-300 sm:block">
              {formatTime(currentTime)} / {formatTime(duration)}
            </div>

            <button
              className="glass-button flex h-11 w-11 shrink-0 items-center justify-center rounded-full text-white"
              aria-label={muted ? "Дыбысты қосу" : "Дыбысты өшіру"}
              onClick={toggleMute}
              type="button"
            >
              {muted || volume === 0 ? <VolumeX className="h-4 w-4" /> : <Volume2 className="h-4 w-4" />}
            </button>

            <input
              className="cinema-range hidden w-24 sm:block"
              aria-label="Дыбыс деңгейі"
              type="range"
              min={0}
              max={1}
              step="0.01"
              value={muted ? 0 : volume}
              onChange={(event) => changeVolume(event.target.value)}
            />

            <div className="ml-auto flex items-center gap-2">
              <select
                className="glass-button h-11 max-w-[116px] rounded-full bg-black/30 px-3 text-xs font-semibold text-white outline-none"
                aria-label="Сапа"
                value={String(manualLevel)}
                onChange={(event) => changeQuality(event.target.value)}
              >
                <option value="-1">Auto</option>
                {qualityLevels.map((level) => (
                  <option key={level.index} value={level.index}>
                    {level.label}
                  </option>
                ))}
              </select>

              <button
                className="glass-button flex h-11 w-11 shrink-0 items-center justify-center rounded-full text-white"
                aria-label={fullscreen ? "Толық экраннан шығу" : "Толық экран"}
                onClick={toggleFullscreen}
                type="button"
              >
                {fullscreen ? <Minimize className="h-4 w-4" /> : <Maximize className="h-4 w-4" />}
              </button>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
