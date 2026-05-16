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
    <section className="glass rounded-[30px] p-5 sm:p-6">
      <div className="mb-4">
        <p className="text-xs font-bold uppercase tracking-[0.22em] text-[var(--accent)]">Сипаттама</p>
        <h2 className="mt-2 text-2xl font-bold tracking-[-0.024em] text-white">Контент туралы</h2>
      </div>
      <p
        className={cn(
          "max-w-4xl text-sm font-medium leading-7 tracking-[0.004em] text-zinc-300 sm:text-base",
          expanded ? "" : "line-clamp-3"
        )}
      >
        {description}
      </p>
      <button
        className="glass-button mt-4 inline-flex min-h-10 items-center gap-2 rounded-full px-4 text-sm font-bold text-white"
        type="button"
        onClick={() => setExpanded((current) => !current)}
      >
        {expanded ? "Жасыру" : "Толығырақ оқу"}
        <ChevronDown className={cn("h-4 w-4 transition", expanded ? "rotate-180" : "")} />
      </button>
    </section>
  );
}
