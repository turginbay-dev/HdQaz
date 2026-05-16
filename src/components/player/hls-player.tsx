"use client";

import { type CSSProperties, type PointerEvent as ReactPointerEvent, useEffect, useRef, useState } from "react";
import Hls, { type ErrorData, type Level } from "hls.js";
import {
  AlertTriangle,
  Check,
  ChevronRight,
  Loader2,
  Maximize,
  Minimize,
  Pause,
  Play,
  RotateCcw,
  RotateCw,
  Settings,
  Volume2,
  VolumeX
} from "lucide-react";
import { cn } from "@/lib/cn";
import { formatMovieLanguages } from "@/lib/movie-taxonomy";
import type { MovieLanguageId } from "@/lib/movie-taxonomy";

type HlsPlayerProps = {
  contentId?: string;
  initialWatchProgress?: InitialWatchProgress | null;
  src: string;
  poster: string;
  languages: MovieLanguageId[];
  skipIntro?: {
    endSeconds: number;
    label?: string;
    startSeconds?: number;
  } | null;
  nextEpisode?: {
    href: string;
    label?: string;
    title?: string;
  } | null;
};

type InitialWatchProgress = {
  completed: boolean;
  contentId: string;
  durationSeconds: number;
  lastPositionSeconds: number;
  progressPercent: number;
  updatedAt?: string;
};

type QualityLevel = {
  height: number;
  index: number;
  label: string;
};

type Toast = {
  id: number;
  message: string;
};

type ActiveMenu = "settings" | "speed" | null;

type SavedProgressSnapshot = {
  completed: boolean;
  contentId: string;
  durationSeconds: number;
  progressSeconds: number;
};

type WebKitFullscreenVideo = HTMLVideoElement & {
  webkitEnterFullscreen?: () => void;
  webkitExitFullscreen?: () => void;
  webkitSupportsFullscreen?: boolean;
};

const playbackSpeeds = [0.5, 0.75, 1, 1.25, 1.5, 2];

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

function formatSpeed(value: number) {
  return value === 1 ? "1x" : `${value}x`;
}

function getSelectableQualityLevels(levels: Level[]): QualityLevel[] {
  const bestByHeight = new Map<number, QualityLevel & { bitrate: number }>();

  levels.forEach((level, index) => {
    if (!level.height || level.height < 720 || level.height > 1080) {
      return;
    }

    const current = bestByHeight.get(level.height);

    if (!current || level.bitrate > current.bitrate) {
      bestByHeight.set(level.height, {
        bitrate: level.bitrate,
        height: level.height,
        index,
        label: `${level.height}p`
      });
    }
  });

  return Array.from(bestByHeight.values())
    .sort((left, right) => left.height - right.height)
    .map(({ bitrate: _bitrate, ...level }) => level);
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

function isHlsManifestUrl(value: string) {
  return value.toLowerCase().split(/[?#]/)[0].endsWith(".m3u8");
}

function getVideoDuration(video: HTMLVideoElement) {
  return Number.isFinite(video.duration) && video.duration > 0 ? video.duration : 0;
}

function isTypingTarget(target: EventTarget | null) {
  if (!(target instanceof HTMLElement)) {
    return false;
  }

  const tagName = target.tagName.toLowerCase();

  return (
    target.isContentEditable ||
    tagName === "a" ||
    tagName === "button" ||
    tagName === "input" ||
    tagName === "select" ||
    tagName === "textarea"
  );
}

function initialSnapshot(progress: InitialWatchProgress | null | undefined): SavedProgressSnapshot | null {
  if (!progress) {
    return null;
  }

  return {
    completed: progress.completed || progress.progressPercent >= 90,
    contentId: progress.contentId,
    durationSeconds: Math.max(0, Math.round(progress.durationSeconds)),
    progressSeconds: Math.max(0, Math.round(progress.lastPositionSeconds))
  };
}

export function HlsPlayer({ contentId, initialWatchProgress, src, poster, languages, skipIntro, nextEpisode }: HlsPlayerProps) {
  const playerRef = useRef<HTMLElement | null>(null);
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const hlsRef = useRef<Hls | null>(null);
  const usingHlsJsRef = useRef(false);
  const streamReadyRef = useRef(false);
  const controlsHideTimerRef = useRef<number | null>(null);
  const toastTimerRef = useRef<number | null>(null);
  const seekPulseTimerRef = useRef<number | null>(null);
  const singleTapTimerRef = useRef<number | null>(null);
  const lastTapRef = useRef({ time: 0, x: 0, y: 0 });
  const lastBackendSaveRef = useRef<SavedProgressSnapshot | null>(initialSnapshot(initialWatchProgress));
  const manualLevelRef = useRef(-1);
  const resumeAppliedRef = useRef(false);

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
  const [controlsVisible, setControlsVisible] = useState(true);
  const [activeMenu, setActiveMenu] = useState<ActiveMenu>(null);
  const [scrubbing, setScrubbing] = useState(false);
  const [cinemaMode, setCinemaMode] = useState(false);
  const [playbackRate, setPlaybackRate] = useState(1);
  const [toast, setToast] = useState<Toast | null>(null);
  const [seekPulse, setSeekPulse] = useState<"backward" | "forward" | null>(null);

  const progressPercent = duration > 0 ? Math.min(100, (currentTime / duration) * 100) : 0;
  const bufferedPercent = duration > 0 ? Math.min(100, (bufferedEnd / duration) * 100) : 0;
  const volumePercent = muted ? 0 : Math.round(volume * 100);
  const activeAutoQuality = qualityLevels.find((level) => level.index === currentLevel)?.label;
  const selectedQuality = qualityLevels.find((level) => level.index === manualLevel)?.label;
  const qualityLabel = manualLevel === -1 ? (activeAutoQuality ? `Auto · ${activeAutoQuality}` : "Auto") : selectedQuality ?? "Auto";
  const durationLabel = duration > 0 ? formatTime(duration) : loading ? "..." : "--:--";
  const visibleChrome = controlsVisible || !playing || loading || Boolean(error) || Boolean(activeMenu) || scrubbing;
  const skipIntroStart = skipIntro?.startSeconds ?? 0;
  const showSkipIntro =
    Boolean(skipIntro) &&
    currentTime >= skipIntroStart &&
    currentTime < (skipIntro?.endSeconds ?? 0) &&
    (skipIntro?.endSeconds ?? 0) > skipIntroStart;
  const showNextEpisode = Boolean(nextEpisode && duration > 0 && currentTime >= Math.max(duration - 45, duration * 0.92));
  const resumePercent = initialWatchProgress?.progressPercent ?? 0;
  const hasResumeProgress = Boolean(
    initialWatchProgress &&
      initialWatchProgress.lastPositionSeconds > 0 &&
      resumePercent > 2 &&
      resumePercent < 90 &&
      !initialWatchProgress.completed
  );
  const resumeBadgeLabel = hasResumeProgress
    ? `Жалғастыру: ${resumePercent}%`
    : initialWatchProgress && (initialWatchProgress.completed || resumePercent >= 90)
      ? "Қайта көру"
      : null;
  const progressStyle = {
    "--buffered": `${bufferedPercent}%`,
    "--progress": `${progressPercent}%`
  } as CSSProperties;
  const volumeStyle = {
    "--volume": `${volumePercent}%`
  } as CSSProperties;

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
    setActiveMenu(null);
    setScrubbing(false);
    setSeekPulse(null);
    manualLevelRef.current = -1;
    lastBackendSaveRef.current = initialSnapshot(initialWatchProgress);
    resumeAppliedRef.current = false;
    hlsRef.current = null;
    usingHlsJsRef.current = false;
    streamReadyRef.current = false;
    video.removeAttribute("src");
    video.load();

    const hlsManifest = isHlsManifestUrl(src);

    if (!hlsManifest) {
      video.src = src;
      video.load();

      return () => {
        streamReadyRef.current = false;
        savePlaybackProgress({ keepalive: true });
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
      usingHlsJsRef.current = true;

      const manifestTimeout = window.setTimeout(() => {
        if (!streamReadyRef.current) {
          console.error("[HlsPlayer] ERROR", {
            details: "manifest timeout",
            src
          });
          setLoading(false);
          setError("HLS manifest жүктелмеді. .m3u8 URL және CORS баптауын тексеріңіз.");
          hls.stopLoad();
        }
      }, 20000);

      const handleMediaAttached = () => {
        console.info("[HlsPlayer] MEDIA_ATTACHED", { src });
      };

      const handleManifestParsed = () => {
        window.clearTimeout(manifestTimeout);
        console.info("[HlsPlayer] MANIFEST_PARSED", {
          duration: getVideoDuration(video),
          levels: hls.levels.length,
          src
        });
        streamReadyRef.current = true;
        setQualityLevels(getSelectableQualityLevels(hls.levels));
        setDuration(getVideoDuration(video));
        setLoading(false);
        setError(null);
      };

      const handleLevelSwitched = (_event: string, data: { level: number }) => {
        setCurrentLevel(data.level);
      };

      const handleError = (_event: string, data: ErrorData) => {
        console.error("[HlsPlayer] ERROR", data);

        if (!data.fatal) {
          return;
        }

        if (manualLevelRef.current !== -1 && streamReadyRef.current) {
          manualLevelRef.current = -1;
          setManualLevel(-1);
          hls.currentLevel = -1;
          hls.nextLoadLevel = -1;
          showToast("Auto quality fallback");
          hls.startLoad();
          return;
        }

        setLoading(false);

        if (data.type === Hls.ErrorTypes.NETWORK_ERROR) {
          setError(
            streamReadyRef.current
              ? "HLS желісі үзілді. Қайта қосып көріңіз."
              : "HLS manifest жүктелмеді. .m3u8 URL және CORS баптауын тексеріңіз."
          );
          hls.startLoad();
          return;
        }

        if (data.type === Hls.ErrorTypes.MEDIA_ERROR) {
          setError("Видео қалпына келтіріліп жатыр...");
          hls.recoverMediaError();
          return;
        }

        setError("HLS stream ашылмады. .m3u8 URL және R2 CORS баптауын тексеріңіз.");
      };

      hls.on(Hls.Events.MEDIA_ATTACHED, handleMediaAttached);
      hls.on(Hls.Events.MANIFEST_PARSED, handleManifestParsed);
      hls.on(Hls.Events.LEVEL_SWITCHED, handleLevelSwitched);
      hls.on(Hls.Events.ERROR, handleError);
      hls.loadSource(src);
      hls.attachMedia(video);

      return () => {
        window.clearTimeout(manifestTimeout);
        savePlaybackProgress({ keepalive: true });
        hls.off(Hls.Events.MEDIA_ATTACHED, handleMediaAttached);
        hls.off(Hls.Events.MANIFEST_PARSED, handleManifestParsed);
        hls.off(Hls.Events.LEVEL_SWITCHED, handleLevelSwitched);
        hls.off(Hls.Events.ERROR, handleError);
        hls.destroy();
        hlsRef.current = null;
        usingHlsJsRef.current = false;
        streamReadyRef.current = false;
        video.removeAttribute("src");
        video.load();
      };
    }

    if (video.canPlayType("application/vnd.apple.mpegurl")) {
      video.src = src;
      video.load();

      return () => {
        streamReadyRef.current = false;
        savePlaybackProgress({ keepalive: true });
        video.removeAttribute("src");
        video.load();
      };
    }

    setLoading(false);
    setError("Бұл браузер HLS stream ойната алмайды.");
  }, [contentId, initialWatchProgress, src]);

  useEffect(() => {
    const video = videoRef.current;

    if (!video) {
      return;
    }

    video.volume = volume;
    video.muted = muted;
  }, [muted, volume]);

  useEffect(() => {
    const video = videoRef.current;

    if (!video) {
      return;
    }

    video.playbackRate = playbackRate;
  }, [playbackRate, src]);

  useEffect(() => {
    const video = videoRef.current;

    const syncFullscreen = () => {
      setFullscreen(Boolean(document.fullscreenElement));
    };
    const handleNativeFullscreenStart = () => setFullscreen(true);
    const handleNativeFullscreenEnd = () => setFullscreen(false);

    document.addEventListener("fullscreenchange", syncFullscreen);
    video?.addEventListener("webkitbeginfullscreen", handleNativeFullscreenStart);
    video?.addEventListener("webkitendfullscreen", handleNativeFullscreenEnd);

    return () => {
      document.removeEventListener("fullscreenchange", syncFullscreen);
      video?.removeEventListener("webkitbeginfullscreen", handleNativeFullscreenStart);
      video?.removeEventListener("webkitendfullscreen", handleNativeFullscreenEnd);
    };
  }, []);

  useEffect(() => {
    window.clearTimeout(controlsHideTimerRef.current ?? undefined);

    if (playing && !loading && !error && !activeMenu && !scrubbing) {
      controlsHideTimerRef.current = window.setTimeout(() => {
        setControlsVisible(false);
      }, 2600);
    } else {
      setControlsVisible(true);
    }

    return () => {
      window.clearTimeout(controlsHideTimerRef.current ?? undefined);
    };
  }, [activeMenu, error, loading, playing, scrubbing]);

  useEffect(() => {
    const closeMenus = (event: PointerEvent) => {
      const player = playerRef.current;

      if (!player || player.contains(event.target as Node)) {
        return;
      }

      setActiveMenu(null);
    };

    document.addEventListener("pointerdown", closeMenus);

    return () => {
      document.removeEventListener("pointerdown", closeMenus);
    };
  }, []);

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      const player = playerRef.current;

      if (!player || isTypingTarget(event.target)) {
        return;
      }

      const target = event.target as Node | null;
      const activeInPlayer = Boolean(target && player.contains(target));
      const playerHovered = player.matches(":hover");
      const playerFullscreen = document.fullscreenElement === player;

      if (!activeInPlayer && !playerHovered && !playerFullscreen) {
        return;
      }

      if (event.key === "Escape" && activeMenu) {
        event.preventDefault();
        setActiveMenu(null);
        return;
      }

      if (event.code === "Space" || event.key.toLowerCase() === "k") {
        event.preventDefault();
        void togglePlayback(true);
        return;
      }

      if (event.key.toLowerCase() === "f") {
        event.preventDefault();
        void toggleFullscreen(true);
        return;
      }

      if (event.key.toLowerCase() === "m") {
        event.preventDefault();
        toggleMute(true);
        return;
      }

      if (event.key === "ArrowLeft") {
        event.preventDefault();
        seekBy(-10, true);
        return;
      }

      if (event.key === "ArrowRight") {
        event.preventDefault();
        seekBy(10, true);
      }
    };

    window.addEventListener("keydown", handleKeyDown);

    return () => {
      window.removeEventListener("keydown", handleKeyDown);
    };
  }, [activeMenu, error, loading, muted, playing, volume]);

  useEffect(() => {
    const saveCurrentProgress = () => savePlaybackProgress({ keepalive: true });

    window.addEventListener("pagehide", saveCurrentProgress);
    window.addEventListener("beforeunload", saveCurrentProgress);

    return () => {
      saveCurrentProgress();
      window.removeEventListener("pagehide", saveCurrentProgress);
      window.removeEventListener("beforeunload", saveCurrentProgress);
      window.clearTimeout(toastTimerRef.current ?? undefined);
      window.clearTimeout(seekPulseTimerRef.current ?? undefined);
      window.clearTimeout(singleTapTimerRef.current ?? undefined);
    };
  }, [contentId, src]);

  async function togglePlayback(announce = false) {
    const video = videoRef.current;

    revealControls();

    if (!video) {
      return;
    }

    if (!streamReadyRef.current) {
      setLoading(true);
      return;
    }

    if (video.paused) {
      try {
        await video.play();
        setPlaying(true);
        setError(null);
        if (announce) {
          showToast("Ойнату");
        }
      } catch {
        setError("Ойнату басталмады. HLS URL қолжетімді екенін тексеріңіз.");
      }
    } else {
      video.pause();
      setPlaying(false);
      if (announce) {
        showToast("Пауза");
      }
    }
  }

  function syncVideoState() {
    const video = videoRef.current;

    if (!video) {
      return;
    }

    const nextCurrentTime = video.currentTime;
    const nextDuration = getVideoDuration(video);

    setCurrentTime(nextCurrentTime);
    setDuration(nextDuration);
    setBufferedEnd(getBufferedEnd(video));

    if (streamReadyRef.current) {
      setLoading(video.readyState < 3 && !video.paused);
    }
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

  function seekBy(seconds: number, announce = false) {
    const video = videoRef.current;

    revealControls();

    if (!video) {
      return;
    }

    const videoDuration = getVideoDuration(video);
    const nextTime = Math.max(0, Math.min(videoDuration || Number.POSITIVE_INFINITY, video.currentTime + seconds));

    video.currentTime = nextTime;
    setCurrentTime(nextTime);
    pulseSeek(seconds > 0 ? "forward" : "backward");

    if (announce) {
      showToast(seconds > 0 ? "+10 сек" : "-10 сек");
    }
  }

  function skipIntroSegment() {
    const endSeconds = skipIntro?.endSeconds;

    if (!endSeconds) {
      return;
    }

    seek(String(endSeconds));
    revealControls();
    showToast("Интро өткізілді");
  }

  function toggleMute(announce = false) {
    const video = videoRef.current;

    revealControls();

    if (!video) {
      return;
    }

    video.muted = !video.muted;
    setMuted(video.muted);

    if (announce) {
      showToast(video.muted ? "Дыбыс өшірулі" : "Дыбыс қосулы");
    }
  }

  function changeVolume(value: string) {
    const nextVolume = Number(value);
    const video = videoRef.current;

    revealControls();

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

    if (!Number.isFinite(nextLevel)) {
      return;
    }

    manualLevelRef.current = nextLevel;
    setManualLevel(nextLevel);
    setActiveMenu(null);

    if (hls) {
      hls.currentLevel = nextLevel;
    }

    const nextLabel = nextLevel === -1 ? "Auto quality" : qualityLevels.find((level) => level.index === nextLevel)?.label;
    showToast(nextLabel ?? "Quality updated");
  }

  function changeSpeed(nextSpeed: number) {
    const video = videoRef.current;

    if (!Number.isFinite(nextSpeed)) {
      return;
    }

    if (video) {
      video.playbackRate = nextSpeed;
    }

    setPlaybackRate(nextSpeed);
    setActiveMenu(null);
    revealControls();
    showToast(`Speed ${formatSpeed(nextSpeed)}`);
  }

  async function toggleFullscreen(announce = false) {
    const player = playerRef.current;
    const video = videoRef.current as WebKitFullscreenVideo | null;

    revealControls();

    if (!player || !video) {
      return;
    }

    try {
      if (document.fullscreenElement) {
        await document.exitFullscreen();
        if (announce) {
          showToast("Толық экран жабылды");
        }
        return;
      }

      if (fullscreen && video.webkitExitFullscreen) {
        video.webkitExitFullscreen();
        setFullscreen(false);
        if (announce) {
          showToast("Толық экран жабылды");
        }
        return;
      }

      if (player.requestFullscreen) {
        try {
          await player.requestFullscreen();
          if (announce) {
            showToast("Толық экран");
          }
          return;
        } catch (requestError) {
          if (!video.webkitEnterFullscreen) {
            throw requestError;
          }
        }
      }

      if (video.webkitEnterFullscreen) {
        video.webkitEnterFullscreen();
        setFullscreen(true);
        if (announce) {
          showToast("Толық экран");
        }
      } else {
        setError("Толық экран режимі бұл браузерде қолжетімсіз.");
      }
    } catch {
      setError("Толық экран режимі іске қосылмады.");
    }
  }

  function retryStream() {
    setError(null);
    setLoading(true);
    revealControls();
    hlsRef.current?.startLoad();

    if (streamReadyRef.current) {
      void videoRef.current?.play().catch(() => {
        setLoading(false);
      });
      return;
    }

    videoRef.current?.load();
  }

  function getProgressSnapshot(): SavedProgressSnapshot | null {
    const video = videoRef.current;

    if (!video || !contentId) {
      return null;
    }

    const videoDuration = getVideoDuration(video);
    const positionSeconds = video.currentTime;

    if (!videoDuration || !Number.isFinite(positionSeconds)) {
      return null;
    }

    const durationSeconds = Math.round(videoDuration);
    const progressSeconds = Math.max(0, Math.min(durationSeconds, Math.round(positionSeconds)));
    const percent = durationSeconds > 0 ? Math.min(100, Math.max(0, Math.round((progressSeconds / durationSeconds) * 100))) : 0;

    if (progressSeconds < 30 || percent <= 2) {
      return null;
    }

    return {
      completed: percent >= 90,
      contentId,
      durationSeconds,
      progressSeconds
    };
  }

  function hasMeaningfulProgressChange(snapshot: SavedProgressSnapshot) {
    const previous = lastBackendSaveRef.current;

    if (!previous || previous.contentId !== snapshot.contentId) {
      return true;
    }

    if (previous.completed !== snapshot.completed) {
      return true;
    }

    return (
      Math.abs(previous.progressSeconds - snapshot.progressSeconds) >= 10 ||
      Math.abs(previous.durationSeconds - snapshot.durationSeconds) >= 5
    );
  }

  function sendProgress(snapshot: SavedProgressSnapshot, keepalive: boolean) {
    const body = JSON.stringify({
      contentId: snapshot.contentId,
      durationSeconds: snapshot.durationSeconds,
      progressSeconds: snapshot.progressSeconds
    });

    if (keepalive && navigator.sendBeacon) {
      try {
        const blob = new Blob([body], { type: "application/json" });

        if (navigator.sendBeacon("/api/watch-progress", blob)) {
          return;
        }
      } catch {
        // Fall through to fetch; progress saving must not affect playback teardown.
      }
    }

    void fetch("/api/watch-progress", {
      body,
      credentials: "same-origin",
      headers: {
        "Content-Type": "application/json"
      },
      keepalive,
      method: "POST"
    }).catch(() => {
      // Progress is retried on the next meaningful player lifecycle event.
    });
  }

  function savePlaybackProgress(options: { keepalive?: boolean } = {}) {
    const snapshot = getProgressSnapshot();

    if (!snapshot || !hasMeaningfulProgressChange(snapshot)) {
      return;
    }

    lastBackendSaveRef.current = snapshot;
    sendProgress(snapshot, Boolean(options.keepalive));
  }

  function restorePlaybackProgress(video: HTMLVideoElement) {
    if (resumeAppliedRef.current) {
      return;
    }

    const saved = initialWatchProgress;
    const videoDuration = getVideoDuration(video);

    if (
      !saved ||
      saved.contentId !== contentId ||
      saved.completed ||
      saved.progressPercent <= 2 ||
      saved.progressPercent >= 90 ||
      saved.lastPositionSeconds <= 0
    ) {
      resumeAppliedRef.current = true;
      return;
    }

    if (videoDuration <= 0 || saved.lastPositionSeconds > videoDuration - 20) {
      return;
    }

    video.currentTime = saved.lastPositionSeconds;
    setCurrentTime(saved.lastPositionSeconds);
    resumeAppliedRef.current = true;
    showToast(`Жалғасты: ${formatTime(saved.lastPositionSeconds)}`);
  }

  function revealControls() {
    setControlsVisible(true);
    window.clearTimeout(controlsHideTimerRef.current ?? undefined);

    if (playing && !loading && !error && !activeMenu && !scrubbing) {
      controlsHideTimerRef.current = window.setTimeout(() => {
        setControlsVisible(false);
      }, 2600);
    }
  }

  function showToast(message: string) {
    window.clearTimeout(toastTimerRef.current ?? undefined);
    setToast({ id: Date.now(), message });
    toastTimerRef.current = window.setTimeout(() => setToast(null), 1800);
  }

  function pulseSeek(direction: "backward" | "forward") {
    window.clearTimeout(seekPulseTimerRef.current ?? undefined);
    setSeekPulse(direction);
    seekPulseTimerRef.current = window.setTimeout(() => setSeekPulse(null), 520);
  }

  function toggleMenu(menu: Exclude<ActiveMenu, null>) {
    revealControls();
    setActiveMenu((current) => (current === menu ? null : menu));
  }

  function toggleCinemaMode() {
    setCinemaMode((current) => {
      const nextValue = !current;
      showToast(nextValue ? "Cinema mode" : "Cinema mode off");
      return nextValue;
    });
    setActiveMenu(null);
    revealControls();
  }

  function handleMediaPointerUp(event: ReactPointerEvent<HTMLDivElement>) {
    if (event.pointerType === "mouse" && event.button !== 0) {
      return;
    }

    const player = playerRef.current;
    const surface = event.currentTarget;

    player?.focus({ preventScroll: true });
    revealControls();

    if (loading || error) {
      return;
    }

    const rect = surface.getBoundingClientRect();
    const x = event.clientX - rect.left;
    const y = event.clientY - rect.top;
    const now = Date.now();
    const lastTap = lastTapRef.current;
    const isDoubleTap = now - lastTap.time < 320 && Math.abs(x - lastTap.x) < 90 && Math.abs(y - lastTap.y) < 90;

    if (isDoubleTap) {
      window.clearTimeout(singleTapTimerRef.current ?? undefined);
      lastTapRef.current = { time: 0, x: 0, y: 0 };

      if (x < rect.width * 0.42) {
        seekBy(-10, true);
        return;
      }

      if (x > rect.width * 0.58) {
        seekBy(10, true);
        return;
      }

      void toggleFullscreen(true);
      return;
    }

    lastTapRef.current = { time: now, x, y };
    window.clearTimeout(singleTapTimerRef.current ?? undefined);
    singleTapTimerRef.current = window.setTimeout(() => {
      void togglePlayback(false);
    }, 240);
  }

  return (
    <>
      {cinemaMode ? <div className="fixed inset-0 z-20 bg-black/72 backdrop-blur-md transition-opacity" aria-hidden="true" /> : null}

      <div className={cn("cinema-player-frame relative", cinemaMode && "z-30")}>
        <section
          ref={playerRef}
          className={cn(
            "cinema-player-shell group relative isolate aspect-video w-full max-w-full overflow-hidden rounded-[18px] border border-white/[0.14] bg-black outline-none transition-[border-radius,box-shadow,transform] duration-500 sm:rounded-[30px]",
            playing && !visibleChrome && "cursor-none"
          )}
          tabIndex={0}
          aria-label="HdQaz video player"
          onFocusCapture={revealControls}
          onPointerMove={revealControls}
        >
          <video
            ref={videoRef}
            poster={poster}
            className="cinema-player-video absolute inset-0 z-0 h-full w-full max-w-full bg-black object-contain"
            crossOrigin="anonymous"
            playsInline
            preload="metadata"
            onCanPlay={() => {
              if (!usingHlsJsRef.current) {
                streamReadyRef.current = true;
                setLoading(false);
              } else if (streamReadyRef.current) {
                setLoading(false);
              }
              restorePlaybackProgress(videoRef.current as HTMLVideoElement);
              syncVideoState();
            }}
            onDurationChange={syncVideoState}
            onLoadedMetadata={() => {
              const video = videoRef.current;

              if (!video) {
                return;
              }

              if (!usingHlsJsRef.current) {
                streamReadyRef.current = true;
              }

              restorePlaybackProgress(video);
              syncVideoState();
            }}
            onError={() => {
              setLoading(false);
              setError("Видео жүктелмеді. HLS URL және CORS баптауын тексеріңіз.");
            }}
            onPlay={() => {
              setPlaying(true);
              setLoading(false);
            }}
            onPause={() => {
              setPlaying(false);
              savePlaybackProgress();
            }}
            onProgress={syncVideoState}
            onTimeUpdate={syncVideoState}
            onEnded={() => {
              setPlaying(false);
              savePlaybackProgress();
            }}
            onVolumeChange={() => {
              const video = videoRef.current;

              if (video) {
                setMuted(video.muted);
                setVolume(video.volume);
              }
            }}
            onWaiting={() => setLoading(true)}
          />

          <div
            className="absolute inset-0 z-10"
            aria-hidden="true"
            onPointerUp={handleMediaPointerUp}
          />

          <div className="pointer-events-none absolute inset-0 z-10 bg-[linear-gradient(180deg,rgba(0,0,0,0.62)_0%,rgba(0,0,0,0.1)_25%,rgba(0,0,0,0.04)_48%,rgba(0,0,0,0.9)_100%)]" />
          <div className="pointer-events-none absolute inset-0 z-10 shadow-[inset_0_0_160px_rgba(0,0,0,0.74)]" />

          <div
            className={cn(
              "cinema-player-topbar absolute left-3 right-3 top-3 z-30 flex items-start justify-between gap-3 transition duration-300 sm:left-5 sm:right-5 sm:top-5",
              visibleChrome ? "translate-y-0 opacity-100" : "-translate-y-2 opacity-0"
            )}
          >
            <div className="cinema-badge inline-flex max-w-[calc(100%-4rem)] items-center gap-2">
              <span className="h-1.5 w-1.5 rounded-full bg-[var(--accent)] shadow-[0_0_14px_rgba(217,183,111,0.65)]" />
              <span className="truncate">{formatMovieLanguages(languages, "short")}</span>
            </div>
          </div>

          {resumeBadgeLabel ? (
            <div
              className={cn(
                "cinema-badge absolute left-3 top-[4.25rem] z-30 transition duration-300 sm:left-5 sm:top-[4.75rem]",
                visibleChrome ? "translate-y-0 opacity-100" : "-translate-y-1 opacity-0"
              )}
            >
              {resumeBadgeLabel}
            </div>
          ) : null}

          {loading && !error ? (
            <div className="pointer-events-none absolute inset-0 z-40 flex items-center justify-center bg-black/18">
              <div className="cinema-loader" aria-label={streamReadyRef.current ? "Буферизация" : "Жүктелуде"}>
                <Loader2 className="h-6 w-6 animate-spin" />
              </div>
            </div>
          ) : null}

          <button
            className={cn(
              "cinema-center-play absolute left-1/2 top-1/2 z-40 flex -translate-x-1/2 -translate-y-1/2 items-center justify-center rounded-full text-white",
              !playing && !loading && !error ? "scale-100 opacity-100" : "pointer-events-none scale-95 opacity-0"
            )}
            aria-label="Ойнату"
            onClick={() => void togglePlayback(false)}
            type="button"
          >
            <Play className="ml-1 h-7 w-7 fill-current sm:h-8 sm:w-8" />
          </button>

          {seekPulse ? (
            <div
              className={cn(
                "cinema-seek-pulse pointer-events-none absolute top-1/2 z-40 -translate-y-1/2",
                seekPulse === "backward" ? "left-[18%]" : "right-[18%]"
              )}
              aria-hidden="true"
            >
              {seekPulse === "backward" ? <RotateCcw className="h-5 w-5" /> : <RotateCw className="h-5 w-5" />}
            </div>
          ) : null}

          {toast ? (
            <div key={toast.id} className="cinema-toast absolute left-1/2 top-[18%] z-50 -translate-x-1/2" aria-live="polite">
              {toast.message}
            </div>
          ) : null}

          {error ? (
            <div className="absolute inset-0 z-50 flex items-center justify-center bg-black/70 px-4 backdrop-blur-md">
              <div className="cinema-error-panel max-w-md rounded-[26px] p-5 text-center sm:p-6">
                <div className="mx-auto mb-3 flex h-11 w-11 items-center justify-center rounded-full border border-red-300/20 bg-red-500/12 text-red-100">
                  <AlertTriangle className="h-5 w-5" />
                </div>
                <p className="text-sm font-semibold leading-6 text-white">{error}</p>
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

          {showSkipIntro || showNextEpisode ? (
            <div
              className={cn(
                "absolute right-3 z-40 flex flex-col items-end gap-2 transition duration-300 sm:right-6",
                visibleChrome ? "bottom-[6rem] sm:bottom-36" : "bottom-4 sm:bottom-6",
                visibleChrome ? "opacity-100" : "opacity-95"
              )}
            >
              {showSkipIntro ? (
                <button className="cinema-action-pill" onClick={skipIntroSegment} type="button">
                  {skipIntro?.label ?? "Интроны өткізу"}
                </button>
              ) : null}
              {showNextEpisode && nextEpisode ? (
                <a className="cinema-action-pill inline-flex items-center gap-2" href={nextEpisode.href}>
                  <span className="max-w-[12rem] truncate">{nextEpisode.label ?? "Келесі серия"}</span>
                  <ChevronRight className="h-4 w-4" />
                </a>
              ) : null}
            </div>
          ) : null}

          <div
            className={cn(
              "cinema-player-controls absolute inset-x-2 bottom-2 z-50 transition duration-300 sm:inset-x-5 sm:bottom-5",
              visibleChrome ? "translate-y-0 opacity-100" : "pointer-events-none translate-y-3 opacity-0"
            )}
          >
            <div className="cinema-control-bar">
              <div className={cn("cinema-progress-shell", scrubbing && "is-scrubbing")} style={progressStyle}>
                <div className="cinema-progress-track" aria-hidden="true">
                  <div className="cinema-progress-buffered" />
                  <div className="cinema-progress-played" />
                </div>
                <input
                  className="cinema-progress-range"
                  aria-label="Көру уақыты"
                  aria-valuetext={`${formatTime(currentTime)} / ${durationLabel}`}
                  type="range"
                  min={0}
                  max={duration || 0}
                  step="0.1"
                  value={Math.min(currentTime, duration || currentTime)}
                  onBlur={() => setScrubbing(false)}
                  onChange={(event) => seek(event.target.value)}
                  onPointerDown={() => setScrubbing(true)}
                  onPointerUp={() => setScrubbing(false)}
                />
              </div>

              <div className="cinema-controls-row">
                <div className="cinema-main-controls">
                  <button
                    className="cinema-control-button cinema-skip-button"
                    aria-label="10 секунд артқа"
                    onClick={() => seekBy(-10, true)}
                    type="button"
                  >
                    <RotateCcw className="h-4 w-4" />
                  </button>

                  <button
                    className="cinema-primary-button"
                    aria-label={playing ? "Пауза" : "Ойнату"}
                    onClick={() => void togglePlayback(false)}
                    type="button"
                  >
                    {playing ? <Pause className="h-5 w-5 fill-current" /> : <Play className="ml-0.5 h-5 w-5 fill-current" />}
                  </button>

                  <button
                    className="cinema-control-button cinema-skip-button"
                    aria-label="10 секунд алға"
                    onClick={() => seekBy(10, true)}
                    type="button"
                  >
                    <RotateCw className="h-4 w-4" />
                  </button>

                  <div className="cinema-time">
                    {formatTime(currentTime)} <span>/</span> {durationLabel}
                  </div>
                </div>

                <div className="cinema-secondary-controls">
                  <div className="cinema-volume" style={volumeStyle}>
                    <button
                      className="cinema-control-button"
                      aria-label={muted ? "Дыбысты қосу" : "Дыбысты өшіру"}
                      onClick={() => toggleMute(true)}
                      type="button"
                    >
                      {muted || volume === 0 ? <VolumeX className="h-4 w-4" /> : <Volume2 className="h-4 w-4" />}
                    </button>

                    <div className="cinema-volume-shell">
                      <div className="cinema-volume-track" aria-hidden="true" />
                      <input
                        className="cinema-volume-range"
                        aria-label="Дыбыс деңгейі"
                        type="range"
                        min={0}
                        max={1}
                        step="0.01"
                        value={muted ? 0 : volume}
                        onChange={(event) => changeVolume(event.target.value)}
                      />
                    </div>
                  </div>

                  <div className="relative">
                    <button
                      className="cinema-menu-trigger px-3"
                      aria-label="Ойнату жылдамдығы"
                      aria-expanded={activeMenu === "speed"}
                      aria-haspopup="menu"
                      onClick={() => toggleMenu("speed")}
                      type="button"
                    >
                      {formatSpeed(playbackRate)}
                    </button>

                    {activeMenu === "speed" ? (
                      <div className="cinema-menu right-0 w-40" role="menu" aria-label="Ойнату жылдамдығы">
                        {playbackSpeeds.map((speed) => (
                          <button
                            key={speed}
                            className={cn("cinema-menu-item", playbackRate === speed && "is-active")}
                            role="menuitemradio"
                            aria-checked={playbackRate === speed}
                            onClick={() => changeSpeed(speed)}
                            type="button"
                          >
                            <span>{formatSpeed(speed)}</span>
                            {playbackRate === speed ? <Check className="h-4 w-4" /> : null}
                          </button>
                        ))}
                      </div>
                    ) : null}
                  </div>

                  <div className="relative">
                    <button
                      className="cinema-control-button"
                      aria-label="Плеер баптаулары"
                      aria-expanded={activeMenu === "settings"}
                      aria-haspopup="menu"
                      onClick={() => toggleMenu("settings")}
                      type="button"
                    >
                      <Settings className="h-4 w-4" />
                    </button>

                    {activeMenu === "settings" ? (
                      <div className="cinema-menu right-0 w-56" role="menu" aria-label="Плеер баптаулары">
                        <div className="cinema-menu-status">
                          <span>Сапа</span>
                          <span>{qualityLabel}</span>
                        </div>
                        <button
                          className={cn("cinema-menu-item", manualLevel === -1 && "is-active")}
                          role="menuitemradio"
                          aria-checked={manualLevel === -1}
                          onClick={() => changeQuality("-1")}
                          type="button"
                        >
                          <span>Auto</span>
                          <span className="cinema-menu-meta">{activeAutoQuality ?? "Best"}</span>
                          {manualLevel === -1 ? <Check className="h-4 w-4" /> : null}
                        </button>
                        {qualityLevels.map((level) => (
                          <button
                            key={level.index}
                            className={cn("cinema-menu-item", manualLevel === level.index && "is-active")}
                            role="menuitemradio"
                            aria-checked={manualLevel === level.index}
                            onClick={() => changeQuality(String(level.index))}
                            type="button"
                          >
                            <span>{level.label}</span>
                            <span className="cinema-menu-meta">{level.height >= 1080 ? "Full HD" : "HD"}</span>
                            {manualLevel === level.index ? <Check className="h-4 w-4" /> : null}
                          </button>
                        ))}
                        <button
                          className={cn("cinema-menu-item", cinemaMode && "is-active")}
                          role="menuitemcheckbox"
                          aria-checked={cinemaMode}
                          onClick={toggleCinemaMode}
                          type="button"
                        >
                          <span>Cinema mode</span>
                          <span className="cinema-toggle-dot" aria-hidden="true" />
                        </button>
                        <div className="cinema-menu-status">
                          <span>Auto fallback</span>
                          <span>On</span>
                        </div>
                      </div>
                    ) : null}
                  </div>

                  <button
                    className="cinema-control-button"
                    aria-label={fullscreen ? "Толық экраннан шығу" : "Толық экран"}
                    onClick={() => void toggleFullscreen(false)}
                    type="button"
                  >
                    {fullscreen ? <Minimize className="h-4 w-4" /> : <Maximize className="h-4 w-4" />}
                  </button>
                </div>
              </div>
            </div>
          </div>
        </section>
      </div>
    </>
  );
}
