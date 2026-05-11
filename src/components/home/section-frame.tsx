import type { ReactNode } from "react";
import { Reveal } from "@/components/motion/reveal";
import { cn } from "@/lib/cn";

type SectionFrameProps = {
  eyebrow?: string;
  title?: string;
  description?: string;
  children: ReactNode;
  className?: string;
};

export function SectionFrame({
  eyebrow,
  title,
  description,
  children,
  className
}: SectionFrameProps) {
  return (
    <section className={cn("relative", className)}>
      <Reveal>
        {(eyebrow || title || description) && (
          <div className="mb-5 flex flex-col gap-3 sm:mb-6 lg:flex-row lg:items-end lg:justify-between">
            <div className="max-w-2xl">
              {eyebrow && (
                <p className="text-xs font-semibold uppercase tracking-[0.32em] text-[var(--accent)]">
                  {eyebrow}
                </p>
              )}
              {title && (
                <h2 className="mt-2 text-2xl font-semibold tracking-tight text-white sm:text-4xl">
                  {title}
                </h2>
              )}
            </div>
            {description && (
              <p className="max-w-xl text-sm leading-6 text-zinc-400 sm:text-base">
                {description}
              </p>
            )}
          </div>
        )}
      </Reveal>
      {children}
    </section>
  );
}
