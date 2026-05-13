"use client";

import { useEffect } from "react";

type MovieViewTrackerProps = {
  movieSlug: string;
};

const storageKey = "hdqaz:view-session-id";

function createSessionId() {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) {
    return `hdqaz:${crypto.randomUUID()}`;
  }

  return `hdqaz:${Date.now().toString(36)}:${Math.random().toString(36).slice(2)}`;
}

function getSessionId() {
  try {
    const existing = window.localStorage.getItem(storageKey);

    if (existing) {
      return existing;
    }

    const next = createSessionId();
    window.localStorage.setItem(storageKey, next);

    return next;
  } catch {
    return createSessionId();
  }
}

export function MovieViewTracker({ movieSlug }: MovieViewTrackerProps) {
  useEffect(() => {
    const controller = new AbortController();

    void fetch("/api/engagement/views", {
      body: JSON.stringify({
        movieSlug,
        sessionId: getSessionId()
      }),
      headers: {
        "Content-Type": "application/json"
      },
      method: "POST",
      signal: controller.signal
    }).catch(() => {
      // View tracking should never interrupt playback.
    });

    return () => controller.abort();
  }, [movieSlug]);

  return null;
}
