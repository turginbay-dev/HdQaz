"use client";

import Image, { type ImageProps } from "next/image";
import { useEffect, useRef, useState } from "react";
import { getMovieImageFallback, getMovieImageSrc } from "@/lib/movie-images";

type MovieImageProps = Omit<ImageProps, "src"> & {
  fallback: "backdrop" | "poster";
  src?: string | null;
};

export function MovieImage({ fallback, onError, src, ...props }: MovieImageProps) {
  const fallbackSrc = getMovieImageFallback(fallback);
  const safeSrc = getMovieImageSrc(src, fallback);
  const [currentSrc, setCurrentSrc] = useState(safeSrc);
  const lastSafeSrc = useRef(safeSrc);

  useEffect(() => {
    if (lastSafeSrc.current !== safeSrc) {
      lastSafeSrc.current = safeSrc;
      setCurrentSrc(safeSrc);
    }
  }, [safeSrc]);

  return (
    <Image
      {...props}
      src={currentSrc}
      onError={(event) => {
        if (currentSrc !== fallbackSrc) {
          setCurrentSrc(fallbackSrc);
        }

        onError?.(event);
      }}
    />
  );
}
