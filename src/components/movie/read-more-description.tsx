"use client";

import { useState } from "react";
import { ChevronDown } from "lucide-react";
import { cn } from "@/lib/cn";

type ReadMoreDescriptionProps = {
  description: string;
};

export function ReadMoreDescription({ description }: ReadMoreDescriptionProps) {
  const [expanded, setExpanded] = useState(false);

  return (
    <section className="description-section">
      <p
        id="movie-description"
        className={cn(
          "max-w-4xl text-sm font-medium leading-7 tracking-[0.004em] text-zinc-300 sm:text-base",
          expanded ? "" : description.length > 240 ? "line-clamp-3" : ""
        )}
      >
        {description}
      </p>
      {description.length > 240 && <button
        className="glass-button mt-4 inline-flex min-h-10 items-center gap-2 rounded-full px-4 text-sm font-bold text-white"
        type="button"
        aria-expanded={expanded}
        aria-controls="movie-description"
        onClick={() => setExpanded((current) => !current)}
      >
        {expanded ? "Жасыру" : "Толығырақ"}
        <ChevronDown className={cn("h-4 w-4 transition", expanded ? "rotate-180" : "")} />
      </button>}
    </section>
  );
}
