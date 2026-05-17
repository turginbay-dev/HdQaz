"use client";

import { useEffect, useRef, useState } from "react";
import { usePathname, useSearchParams } from "next/navigation";
import { AppLoadingScreen } from "@/components/layout/app-loading-screen";

const MIN_VISIBLE_MS = 260;
const MAX_VISIBLE_MS = 5000;

function isMobileViewport() {
  return window.matchMedia("(max-width: 768px)").matches;
}

function isModifiedClick(event: MouseEvent) {
  return event.metaKey || event.ctrlKey || event.shiftKey || event.altKey;
}

function shouldShowForLink(link: HTMLAnchorElement) {
  if (link.target && link.target !== "_self") {
    return false;
  }

  if (link.hasAttribute("download")) {
    return false;
  }

  const href = link.getAttribute("href");

  if (!href || href.startsWith("#") || href.startsWith("mailto:") || href.startsWith("tel:")) {
    return false;
  }

  const nextUrl = new URL(href, window.location.href);

  if (nextUrl.origin !== window.location.origin) {
    return false;
  }

  return nextUrl.pathname !== window.location.pathname || nextUrl.search !== window.location.search;
}

export function NavigationLoadingOverlay() {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const routeKey = `${pathname}?${searchParams.toString()}`;
  const [visible, setVisible] = useState(false);
  const startedAtRef = useRef(0);
  const fallbackTimerRef = useRef<number | null>(null);
  const hideTimerRef = useRef<number | null>(null);

  useEffect(() => {
    return () => {
      window.clearTimeout(fallbackTimerRef.current ?? undefined);
      window.clearTimeout(hideTimerRef.current ?? undefined);
    };
  }, []);

  useEffect(() => {
    if (!visible) {
      return;
    }

    window.clearTimeout(hideTimerRef.current ?? undefined);

    const elapsed = Date.now() - startedAtRef.current;
    const delay = Math.max(MIN_VISIBLE_MS - elapsed, 90);

    hideTimerRef.current = window.setTimeout(() => {
      setVisible(false);
    }, delay);
  }, [routeKey, visible]);

  useEffect(() => {
    function beginLoading() {
      if (!isMobileViewport()) {
        return;
      }

      window.clearTimeout(fallbackTimerRef.current ?? undefined);
      window.clearTimeout(hideTimerRef.current ?? undefined);
      startedAtRef.current = Date.now();
      setVisible(true);
      fallbackTimerRef.current = window.setTimeout(() => setVisible(false), MAX_VISIBLE_MS);
    }

    function handleClick(event: MouseEvent) {
      if (event.defaultPrevented || event.button !== 0 || isModifiedClick(event)) {
        return;
      }

      const target = event.target instanceof Element ? event.target : null;
      const link = target?.closest<HTMLAnchorElement>("a[href]");

      if (link && shouldShowForLink(link)) {
        beginLoading();
      }
    }

    function handleSubmit(event: SubmitEvent) {
      if (event.defaultPrevented) {
        return;
      }

      const form = event.target instanceof HTMLFormElement ? event.target : null;

      if (!form) {
        return;
      }

      const action = new URL(form.action || window.location.href, window.location.href);

      if (action.origin === window.location.origin) {
        beginLoading();
      }
    }

    document.addEventListener("click", handleClick, true);
    document.addEventListener("submit", handleSubmit, true);
    window.addEventListener("popstate", beginLoading);

    return () => {
      document.removeEventListener("click", handleClick, true);
      document.removeEventListener("submit", handleSubmit, true);
      window.removeEventListener("popstate", beginLoading);
    };
  }, []);

  return visible ? <AppLoadingScreen /> : null;
}
